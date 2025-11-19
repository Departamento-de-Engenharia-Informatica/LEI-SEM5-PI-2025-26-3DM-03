using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TodoApi.Migrations
{
    /// <inheritdoc />
    public partial class AddRoleChangeTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastRoleChangeConfirmedUtc",
                table: "AppUsers",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastRoleChangeSentUtc",
                table: "AppUsers",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastRoleChangeSummary",
                table: "AppUsers",
                type: "TEXT",
                maxLength: 400,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastRoleChangeConfirmedUtc",
                table: "AppUsers");

            migrationBuilder.DropColumn(
                name: "LastRoleChangeSentUtc",
                table: "AppUsers");

            migrationBuilder.DropColumn(
                name: "LastRoleChangeSummary",
                table: "AppUsers");
        }
    }
}
