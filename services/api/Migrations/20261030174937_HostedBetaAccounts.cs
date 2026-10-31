using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Tripora.Api.Migrations
{
    /// <inheritdoc />
    public partial class HostedBetaAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AuthorId",
                table: "Places",
                type: "text",
                nullable: true);

            // Earliest retained place receipt identifies the original creator.
            migrationBuilder.Sql("""
                WITH creators AS (
                  SELECT DISTINCT ON ("ResponseJson"::jsonb->>'id')
                    "ResponseJson"::jsonb->>'id' AS id, "ActorId" AS author
                  FROM "Receipts"
                  WHERE "ResponseJson"::jsonb ? 'category' AND "ResponseJson"::jsonb ? 'visited'
                  ORDER BY "ResponseJson"::jsonb->>'id', ("ResponseJson"::jsonb->>'version')::bigint
                )
                UPDATE "Places" p SET "AuthorId" = c.author FROM creators c WHERE p."Id"::text = c.id;
                """);

            migrationBuilder.AddColumn<bool>(
                name: "PendingDeletion",
                table: "MediaAssets",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "DataProtectionKeys",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FriendlyName = table.Column<string>(type: "text", nullable: true),
                    Xml = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DataProtectionKeys", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DataProtectionKeys");

            migrationBuilder.DropColumn(
                name: "AuthorId",
                table: "Places");

            migrationBuilder.DropColumn(
                name: "PendingDeletion",
                table: "MediaAssets");
        }
    }
}
