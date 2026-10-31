using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Tripora.Api.Data;

namespace Tripora.Api.Features;
public record PlanData(string Title, string Notes, string Date, string Time, string Category, Guid? PlaceId, bool Done);
public record PackingData(string Title, bool Packed);
public record BudgetData(string Currency, string? BudgetMinor);
public record ExpenseData(string Title, string Notes, string Date, string Category, string AmountMinor, string Currency, string Payer);
public record MemoryData(string Title, string Notes, Guid? PlaceId, Guid? MediaId);
public static class EntryRules
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static bool Feature(string value) => value is "plan" or "packing" or "budget" or "expense" or "memory";
    private static bool Title(string? value) => !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= 120;
    private static bool Notes(string? value) => value is { Length: <= 2000 };
    public static bool Currency(string? value) => value is "EUR" or "USD" or "GBP";
    public static bool Money(string? value, bool zero = false) => value is not null && Regex.IsMatch(value, "^(0|[1-9][0-9]{0,11})$") && long.TryParse(value, out var amount) && (zero || amount > 0);
    private static bool Date(string? value, out DateOnly date) => DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
    public static async Task<string?> Normalize(string feature, JsonElement raw, TripRecord trip, string actorId, TriporaDb db, TripEntry? old)
    {
        try
        {
            switch (feature)
            {
                case "plan":
                    var p = raw.Deserialize<PlanData>(Json);
                    if (p is null || !Title(p.Title) || !Notes(p.Notes) || p.Date is null || p.Time is null || p.Category is not ("activity" or "transport" or "stay")) return null;
                    if (p.Date.Length == 0 ? p.Time.Length > 0 : !Date(p.Date, out var date) || date < trip.StartDate || date > trip.EndDate) return null;
                    if (p.Time.Length > 0 && !Regex.IsMatch(p.Time, "^([01][0-9]|2[0-3]):[0-5][0-9]$")) return null;
                    if (!await PlaceAllowed(p.PlaceId, trip.Id, db)) return null;
                    return JsonSerializer.Serialize(p with { Title = p.Title.Trim(), Notes = p.Notes.Trim() }, Json);
                case "packing":
                    var packing = raw.Deserialize<PackingData>(Json);
                    return packing is not null && Title(packing.Title) ? JsonSerializer.Serialize(packing with { Title = packing.Title.Trim() }, Json) : null;
                case "budget":
                    var budget = raw.Deserialize<BudgetData>(Json);
                    if (budget is null || !Currency(budget.Currency) || (budget.BudgetMinor is not null && !Money(budget.BudgetMinor, true))) return null;
                    if (old is not null && old.DataJson != "{}" && JsonSerializer.Deserialize<BudgetData>(old.DataJson, Json)!.Currency != budget.Currency &&
                        await db.Entries.AnyAsync(e => e.TripId == trip.Id && e.Feature == "expense")) return null;
                    return JsonSerializer.Serialize(budget, Json);
                case "expense":
                    var expense = raw.Deserialize<ExpenseData>(Json);
                    if (expense is null || !Title(expense.Title) || !Notes(expense.Notes) || !Date(expense.Date, out _) || !Title(expense.Category) ||
                        expense.Payer is not { Length: <= 120 } || !Money(expense.AmountMinor) || !Currency(expense.Currency)) return null;
                    var settings = await db.Entries.SingleOrDefaultAsync(e => e.Id == trip.Id && e.TripId == trip.Id && e.Feature == "budget" && !e.Deleted);
                    if (settings is null || JsonSerializer.Deserialize<BudgetData>(settings.DataJson, Json)!.Currency != expense.Currency) return null;
                    return JsonSerializer.Serialize(expense with { Title = expense.Title.Trim(), Notes = expense.Notes.Trim(), Category = expense.Category.Trim(), Payer = expense.Payer.Trim() }, Json);
                case "memory":
                    var memory = raw.Deserialize<MemoryData>(Json);
                    if (memory is null || !Title(memory.Title) || !Notes(memory.Notes) || !await PlaceAllowed(memory.PlaceId, trip.Id, db)) return null;
                    if (memory.MediaId is Guid id)
                    {
                        var media = await db.MediaAssets.SingleOrDefaultAsync(m => m.Id == id && m.TripId == trip.Id);
                        if (media is null) return null;
                        var oldMedia = old is null ? null : JsonSerializer.Deserialize<MemoryData>(old.DataJson, Json)?.MediaId;
                        if (media.AuthorId != actorId && oldMedia != id) return null;
                    }
                    return JsonSerializer.Serialize(memory with { Title = memory.Title.Trim(), Notes = memory.Notes.Trim() }, Json);
                default: return null;
            }
        }
        catch (Exception error) when (error is JsonException or InvalidOperationException or FormatException) { return null; }
    }
    private static Task<bool> PlaceAllowed(Guid? id, Guid tripId, TriporaDb db) => id is null ? Task.FromResult(true) : db.Places.AnyAsync(p => p.Id == id && p.TripId == tripId && !p.Deleted);
}
