#! "netcoreapp2.1"
#r "nuget: Glob.cs, *"

using Ganss.IO;
using System.Text.RegularExpressions;

char ToNote(Match m)
{
    var n = int.Parse(m.Groups[1].Value);
    var d = m.Groups[2].Value == "1";
    var u = m.Groups[3].Value == "1";
    if (d) n -= 12;
    if (u) n += 12;

    if (n >= 36) n = (n % 12) + 24;

    return (char)(n + 82);
}

string ToSettings(Match m)
{
    var s = $"!{m.Groups[4].Value}${m.Groups[5].Value}#{m.Groups[6].Value}";
    return s;
}

var o = "";

foreach (var fn in Glob.ExpandNames("./**/*.pat"))
{
    var lines = File.ReadAllLines(fn).Where(l => !l.StartsWith(";"));
    var steps = lines.Select(l => Regex.Match(l, @"^(-?\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)"))
        .Select(m => $"{ToNote(m)}{ToSettings(m)}=").ToList();

    o = o + string.Join("\n", steps) + "\n~\n";
}

File.WriteAllText("input_patterns.txt", o);
