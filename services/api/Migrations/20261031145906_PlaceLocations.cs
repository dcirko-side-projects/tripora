using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tripora.Api.Migrations
{
    /// <inheritdoc />
    public partial class PlaceLocations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LocationJson",
                table: "Places",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PlaceSearchCache",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    ResultsJson = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlaceSearchCache", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlaceSearchCache");

            migrationBuilder.DropColumn(
                name: "LocationJson",
                table: "Places");
        }
    }
}
