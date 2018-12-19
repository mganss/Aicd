inlets = 1;
outlets = 3;
autowatch = 1;

include("lm.js");

var temperature = 1.0;
var velocity = 100;
var patternLength = 16;
var currentSteps = [];

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
}
