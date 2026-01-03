using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TodoApi.Migrations
{
    /// <inheritdoc />
    public partial class AddDataRightsResponses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "RespondedAtUtc",
                table: "DataRightsRequests",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResponseNote",
                table: "DataRightsRequests",
                type: "TEXT",
                maxLength: 400,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RespondedAtUtc",
                table: "DataRightsRequests");

            migrationBuilder.DropColumn(
                name: "ResponseNote",
                table: "DataRightsRequests");
        }
    }
}
