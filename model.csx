#! "netcoreapp2.1"
#r "nuget: Newtonsoft.Json, *"

using Newtonsoft.Json;

Dictionary<char, double> Normalize(Dictionary<char, double> counter)
{
    var s = (double)counter.Sum(c => c.Value);
    return counter.ToDictionary(i => i.Key, i => i.Value / s);
}

Dictionary<string, Dictionary<char, double>> TrainCharLm(string fname, int order = 4)
{
    var data = File.ReadAllText(fname);
    var lm = new Dictionary<string, Dictionary<char, int>>();

    for (int i = 0; i < data.Length - order; i++)
    {
        var history = data.Substring(i, order);
        var ch = data[i + order];
        if (lm.TryGetValue(history, out var counter))
            if (counter.ContainsKey(ch))
                counter[ch] += 1;
            else
                counter[ch] = 1;
        else
            lm[history] = new Dictionary<char, int> { [ch] = 1 };
    }

    var outlm = lm.ToDictionary(i => i.Key, i => Normalize(i.Value.ToDictionary(c => c.Key, c => (double)c.Value)));

    return outlm;
}

var random = new Random();
char GenerateLetter(Dictionary<string, Dictionary<char, double>> lm, string history, int order, double temperature)
{
    var h = history.Substring(history.Length - order);
    var dist = lm[h].Select(c => (c.Key, (c.Value / temperature) + 1.0 - (1.0 / temperature)));
    var x = random.NextDouble();
    foreach (var item in dist)
    {
        x = x - item.Item2;
        if (x <= 0) return item.Item1;
    }

    throw new ArgumentException($"no next character for history '{history}', order {order}");
}

string GenerateText(Dictionary<string, Dictionary<char, double>> lm, int order, int nletters = 1000, double temperature = 1.0)
{
    var starts = lm.Keys.Where(k => k.EndsWith("~\n")).ToList();
    var startIndex = random.Next(starts.Count);
    var history = starts[startIndex];
    var sb = new StringBuilder();
    for (int i = 0; i < nletters; i++)
    {
        var c = GenerateLetter(lm, history, order, temperature);
        history = history.Substring(history.Length - order) + c;
        sb.Append(c);
    }

    return sb.ToString();
}