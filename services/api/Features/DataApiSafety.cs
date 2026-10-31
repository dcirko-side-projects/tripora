using Microsoft.EntityFrameworkCore;
using Tripora.Api.Data;

namespace Tripora.Api.Features;

public static class DataApiSafety
{
    public static async Task EnsurePrivateDatabase(TriporaDb db, bool requireSupabaseRoles = true)
    {
        var exposed = await db.Database.SqlQueryRaw<bool>("""
            SELECT EXISTS (
              SELECT 1 FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
                AND has_schema_privilege(oid, 'public', 'USAGE')
            ) AS "Value"
            """).SingleAsync();
        if (exposed) throw new InvalidOperationException("Public database schema is exposed to Supabase Data API roles. Run deploy/supabase-private-database.sql first.");
        // Missing roles indicate a different service/project; do not silently treat that as a hardened Supabase deployment.
        var roles = await db.Database.SqlQueryRaw<long>("SELECT count(*) AS \"Value\" FROM pg_roles WHERE rolname IN ('anon', 'authenticated')").SingleAsync();
        if (requireSupabaseRoles && roles != 2) throw new InvalidOperationException("Expected dedicated Supabase database roles are missing.");
    }
}
