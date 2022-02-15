inlets = 1;
outlets = 3;
autowatch = 1;

include("lm.js");

var temperature = 1.0;
var velocity = 100;
var patternLength = 16;
var currentSteps = [];
var majorVersion;

function setInitialized(v) {
    if (v === 0) {
        outlet(2, 1);
        bang();
        outlet(0, "zoom_fit");
    }
}

function generateLetter(lm, history, order, temperature) {
    var h = history.slice(-order);
    var dist = {};
    var l = lm[h];
    for (var key in l) {
        if (l.hasOwnProperty(key)) {
            var v = l[key];
            dist[key] = (v / temperature) + 1.0 - (1.0 / temperature);
        }
    }
    var x = Math.random();
    for (var k in dist) {
        if (dist.hasOwnProperty(k)) {
            var p = dist[k];
            x = x - p;
            if (x <= 0.0) return k;
        }
    }
}

function generateText(lm, order, nletters, temperature) {
    var starts = Object.keys(lm).filter(function (k) { return k.slice(-2) === "~\n"; });
    var history = starts[Math.floor(Math.random() * Math.floor(starts.length))];
    var s = "";
    for (var i = 0; i < nletters; i++) {
        var c = generateLetter(lm, history, order, temperature);
        history = history.slice(1) + c;
        s += c;
    }
    return s;
}

function generatePattern(lm, order, patternLength, temperature) {
    var stepLength = 9;
    var text = generateText(lm, order, (stepLength + 2) * patternLength, temperature);
    var lines = text.split("\n");
    var re = /^(.)!([01])\$([01])#([01])=$/;
    var s = 0;
    var steps = [];
    var c1 = 36;

    for (var l = 0; l < lines.length; l++) {
        var line = lines[l];
        if (line === "~") continue;
        var m = line.match(re);
        if (m === null) continue;

        var step = {
            note: m[1].charCodeAt(0) - 82 + c1,
            accent: m[2] === "1",
            slide: m[3] === "1" ? 1 : 0,
            gate: m[4] === "1" ? 1 : 0
        };

        steps.push(step);

        s = s + 1;
        if (s === patternLength) break;
    }

    return steps;
}

function sendCurrentSteps() {
    for (var s = 0; s < currentSteps.length; s++) {
        var step = currentSteps[s];
        outlet(0, "step", s + 1, step.note, step.accent ? 127 : velocity, 120, step.slide, step.gate);
    }
    clipOut();
}

function bang() {
    currentSteps = generatePattern(lm, 18, patternLength, temperature);
    sendCurrentSteps();
    outlet(1, "bang");
}

function setTemperature(t) {
    temperature = t;
}

function setVelocity(v) {
    velocity = v;
    sendCurrentSteps();
}

function setPatternLength(p) {
    patternLength = p;
    clipOut();
}

var fixGate = false;

function setFixGate(v) {
    fixGate = v === 1;
    clipOut();
}

function Note(pitch, start, duration, velocity, muted) {
    this.Pitch = pitch;
    this.Start = start;
    this.Duration = duration;
    this.Velocity = velocity;
}

var liveSteps = [];
var liveStepsLen = 0;

function dumpStep(s, i, pitch, velocity, l, slide, gate) {
    if (s === "changed") {
        clipOut();
    } else {
        if (gate === undefined) return;
        liveSteps[i - 1] = {
            pitch: pitch,
            velocity: velocity,
            slide: slide,
            gate: gate
        };
        liveStepsLen = i;
    }
}

function generateMidi() {
    var notes = [];
    var i;
    var previousNote = null;

    for (i = 0; i < liveStepsLen; i++) {
        var step = liveSteps[i];
        var previousStep = i > 0 ? liveSteps[i - 1] : null;
        if (!fixGate && step.gate === 0) continue;
        if (previousStep !== null && previousStep.pitch === step.pitch && previousStep.slide === 1 && (fixGate || previousStep.gate === 1)) {
            // slide and same pitch as previous step -> extend duration of previous note
            if (step.slide === 1)
                previousNote.Duration += 0.25;
        } else {
            var note = new Note(step.pitch, i / 4.0, step.slide === 1 ? 0.375 : 0.125, step.velocity);
            notes.push(note);
            previousNote = note;
        }
    }

    return notes;
}

function getTrackPath() {
    var path = "this_device canonical_parent";
    var parent = new LiveAPI(path);
    
    while (parent.type !== "Track") {
        path = path + " canonical_parent";
        parent = new LiveAPI(path);
    } 

    return path;
}

function clip() {
    var trackPath = getTrackPath();
    var track = new LiveAPI(trackPath);
    var clipSlots = track.getcount("clip_slots");
    var clipSlot;

    var firstClip = null;

    for (var clipSlotNum = 0; clipSlotNum < clipSlots; clipSlotNum++) {
        clipSlot = new LiveAPI(trackPath + " clip_slots " + clipSlotNum);
        var hasClip = clipSlot.get("has_clip").toString() !== "0";
        if (!hasClip) break;
    }

    if (clipSlotNum === clipSlots) {
        // have to create new clip slot (scene)
        var set = new LiveAPI("live_set");
        set.call("create_scene", -1);
        clipSlot = new LiveAPI(trackPath + " clip_slots " + clipSlotNum);
    }

    var beats = Math.ceil(patternLength / 4);
    clipSlot.call("create_clip", beats);
    var clip = new LiveAPI(trackPath + " clip_slots " + clipSlotNum + " clip");
    var notes = generateMidi();

    setNotes(clip, notes);
}

function setNotes(clip, notes) {
    if (majorVersion <= 10) {
        clip.call("set_notes");
        clip.call("notes", notes.length);
    
        for (var i = 0; i < notes.length; i++) {
            var note = notes[i];
            clip.call("note", note.Pitch, note.Start.toFixed(4), note.Duration.toFixed(4), note.Velocity, note.Muted);
        }
    
        clip.call("done");
    } else {
        var noteSpecifications = [];

        for (var i = 0; i < notes.length; i++) {
            var note = notes[i];
            var noteSpecification = {
                pitch: note.Pitch,
                start_time: note.Start,
                duration: note.Duration,
                velocity: note.Velocity,
                mute: note.Muted
            };
            noteSpecifications.push(noteSpecification);
        }

        var notesToAdd = {
            notes: noteSpecifications
        };

        clip.call("add_new_notes", notesToAdd);
    }
}

var clips = {
    out: null
};
var ids = {
    out: 0
};
var init = false;

function liveInit() {
    majorVersion = new LiveAPI("live_app").call("get_major_version");
    init = true;
    if (ids.out !== 0) {
        setOut(ids.out);
    }
}

function setClip(name, id) {
    if (!init) {
        ids[name] = id;
        return;
    }
    if (id === 0) {
        clips[name] = null;
        return;
    }
    var clipId = "id " + id;
    clips[name] = new LiveAPI(clipId);
}

function setOut(id) {
    setClip("out", id);
    clipOut();
}

function clipOut() {
    if (clips.out !== null) {
        var outClip = clips.out;
        callPatternStepDump();
        var stepNotes = generateMidi();
        if (stepNotes === undefined) stepNotes = [];
        replaceAllNotes(outClip, stepNotes);
    }
}

function replaceAllNotes(clip, notes) {
    if (majorVersion <= 10) {
        clip.call("select_all_notes");
        clip.call("replace_selected_notes");
        clip.call("notes", notes.length);
    
        for (var i = 0; i < notes.length; i++) {
            var note = notes[i];
            callNote(clip, note);
        }
    
        clip.call("done");
    } else {
        clip.call("remove_notes_extended", 0, 127, 0, 4294967295);
        setNotes(clip, notes);
    }
}

function callNote(clip, note) {
    clip.call("note", note.Pitch, note.Start.toFixed(4), note.Duration.toFixed(4), note.Velocity, note.Muted);
}

function callPatternStepDump() {
    var patternStep = this.patcher.getnamed("patternStep");
    patternStep.message("dump");
}

function recallPreset() {
    clipOut();
}
