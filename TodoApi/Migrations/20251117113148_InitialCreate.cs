using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace TodoApi.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AppUsers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Email = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    ExternalId = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    Active = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppUsers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Docks",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Location = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Length = table.Column<double>(type: "REAL", nullable: false),
                    Depth = table.Column<double>(type: "REAL", nullable: false),
                    MaxDraft = table.Column<double>(type: "REAL", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Docks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Qualifications",
                columns: table => new
                {
                    Code = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Qualifications", x => x.Code);
                });

            migrationBuilder.CreateTable(
                name: "ResourceAccessLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ResourceId = table.Column<long>(type: "INTEGER", nullable: true),
                    Action = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    UserId = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    UserEmail = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    IpAddress = table.Column<string>(type: "TEXT", maxLength: 80, nullable: true),
                    UserAgent = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResourceAccessLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Resources",
                columns: table => new
                {
                    Code = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 250, nullable: false),
                    Type = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    OperationalCapacity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    AssignedArea = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    SetupTimeMinutes = table.Column<int>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Resources", x => x.Code);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Active = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SharedResources",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    FileName = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false),
                    MimeType = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Size = table.Column<long>(type: "INTEGER", nullable: false),
                    DiskPath = table.Column<string>(type: "TEXT", maxLength: 1024, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    UploadedBy = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SharedResources", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ShippingAgents",
                columns: table => new
                {
                    TaxNumber = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    LegalName = table.Column<string>(type: "TEXT", maxLength: 150, nullable: false),
                    AlternativeName = table.Column<string>(type: "TEXT", maxLength: 150, nullable: false),
                    Type = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    Address_Street = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Address_City = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    Address_PostalCode = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    Address_Country = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShippingAgents", x => x.TaxNumber);
                });

            migrationBuilder.CreateTable(
                name: "StaffMembers",
                columns: table => new
                {
                    MecanographicNumber = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    ShortName = table.Column<string>(type: "TEXT", maxLength: 150, nullable: false),
                    Email = table.Column<string>(type: "TEXT", maxLength: 150, nullable: false),
                    PhoneNumber = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    StartTime = table.Column<TimeSpan>(type: "TEXT", nullable: true),
                    EndTime = table.Column<TimeSpan>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    Active = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffMembers", x => x.MecanographicNumber);
                });

            migrationBuilder.CreateTable(
                name: "StorageAreas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Type = table.Column<int>(type: "INTEGER", nullable: false),
                    Location = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    MaxCapacityTEU = table.Column<int>(type: "INTEGER", nullable: false),
                    CurrentOccupancyTEU = table.Column<int>(type: "INTEGER", nullable: false),
                    ServedDockIds = table.Column<string>(type: "TEXT", nullable: false),
                    DockDistances = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StorageAreas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "VesselVisitNotifications",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    VesselId = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    AgentId = table.Column<long>(type: "INTEGER", nullable: false),
                    ArrivalDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DepartureDate = table.Column<DateTime>(type: "TEXT", nullable: true),
                    SubmittedByRepresentativeEmail = table.Column<string>(type: "TEXT", nullable: true),
                    SubmittedByRepresentativeName = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    SubmissionTimestamp = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ApprovedDockId = table.Column<long>(type: "INTEGER", nullable: true),
                    RejectionReason = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    DecisionTimestamp = table.Column<DateTime>(type: "TEXT", nullable: true),
                    OfficerId = table.Column<long>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VesselVisitNotifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "VesselTypes",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 250, nullable: false),
                    Capacity = table.Column<int>(type: "INTEGER", nullable: false),
                    MaxRows = table.Column<int>(type: "INTEGER", nullable: false),
                    MaxBays = table.Column<int>(type: "INTEGER", nullable: false),
                    MaxTiers = table.Column<int>(type: "INTEGER", nullable: false),
                    DockId = table.Column<long>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VesselTypes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VesselTypes_Docks_DockId",
                        column: x => x.DockId,
                        principalTable: "Docks",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ResourceQualifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    QualificationCode = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    ResourceCode = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResourceQualifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ResourceQualifications_Resources_ResourceCode",
                        column: x => x.ResourceCode,
                        principalTable: "Resources",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserRoles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AppUserId = table.Column<int>(type: "INTEGER", nullable: false),
                    RoleId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserRoles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserRoles_AppUsers_AppUserId",
                        column: x => x.AppUserId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserRoles_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Representative",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    CitizenID = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    Nationality = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    Email = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PhoneNumber = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    ShippingAgentTaxNumber = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Representative", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Representative_ShippingAgents_ShippingAgentTaxNumber",
                        column: x => x.ShippingAgentTaxNumber,
                        principalTable: "ShippingAgents",
                        principalColumn: "TaxNumber",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StaffQualifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    QualificationCode = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    StaffMecanographicNumber = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffQualifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StaffQualifications_StaffMembers_StaffMecanographicNumber",
                        column: x => x.StaffMecanographicNumber,
                        principalTable: "StaffMembers",
                        principalColumn: "MecanographicNumber",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ContainerItem",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ContainerCode = table.Column<string>(type: "TEXT", nullable: false),
                    CargoType = table.Column<string>(type: "TEXT", nullable: true),
                    IsForUnloading = table.Column<bool>(type: "INTEGER", nullable: false),
                    VesselVisitNotificationId = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContainerItem", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ContainerItem_VesselVisitNotifications_VesselVisitNotificationId",
                        column: x => x.VesselVisitNotificationId,
                        principalTable: "VesselVisitNotifications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CrewMember",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    CitizenId = table.Column<string>(type: "TEXT", nullable: false),
                    Nationality = table.Column<string>(type: "TEXT", nullable: false),
                    VesselVisitNotificationId = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CrewMember", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CrewMember_VesselVisitNotifications_VesselVisitNotificationId",
                        column: x => x.VesselVisitNotificationId,
                        principalTable: "VesselVisitNotifications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Vessels",
                columns: table => new
                {
                    Imo = table.Column<string>(type: "TEXT", maxLength: 7, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    VesselTypeId = table.Column<long>(type: "INTEGER", nullable: false),
                    Operator = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Vessels", x => x.Imo);
                    table.ForeignKey(
                        name: "FK_Vessels_VesselTypes_VesselTypeId",
                        column: x => x.VesselTypeId,
                        principalTable: "VesselTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "AppUsers",
                columns: new[] { "Id", "Active", "Email", "ExternalId", "Name" },
                values: new object[,]
                {
                    { 1, true, "admin@example.com", null, "Local Admin" },
                    { 2, true, "salvadordevlapr@gmail.com", null, "Salvador DevLapr" },
                    { 3, true, "portauthoritylapr5@gmail.com", null, "Port Authority LAPR5" }
                });

            migrationBuilder.InsertData(
                table: "Docks",
                columns: new[] { "Id", "Depth", "Length", "Location", "MaxDraft", "Name" },
                values: new object[,]
                {
                    { 1L, 15.0, 300.0, "North Side", 12.0, "North Pier 1" },
                    { 2L, 12.0, 250.0, "East Side", 10.0, "East Dock A" }
                });

            migrationBuilder.InsertData(
                table: "Qualifications",
                columns: new[] { "Code", "Description" },
                values: new object[,]
                {
                    { "STS_OP", "STS Crane Operator" },
                    { "TRUCK_DRV", "Truck Driver" }
                });

            migrationBuilder.InsertData(
                table: "Resources",
                columns: new[] { "Code", "AssignedArea", "Description", "OperationalCapacity", "SetupTimeMinutes", "Status", "Type" },
                values: new object[,]
                {
                    { "CRANE_01", "Dock 1", "STS Crane 01", 50.0m, 30, "Active", "Crane" },
                    { "TRUCK_01", "Yard A", "Yard Truck 01", 20.0m, 15, "Active", "Truck" }
                });

            migrationBuilder.InsertData(
                table: "Roles",
                columns: new[] { "Id", "Active", "Name" },
                values: new object[,]
                {
                    { 1, true, "Admin" },
                    { 2, true, "ExternalIamProvider" },
                    { 3, true, "PortAuthorityOfficer" },
                    { 4, true, "ShippingAgentRepresentative" },
                    { 5, true, "LogisticsOperator" }
                });

            migrationBuilder.InsertData(
                table: "ShippingAgents",
                columns: new[] { "TaxNumber", "Address_City", "Address_Country", "Address_PostalCode", "Address_Street", "AlternativeName", "LegalName", "Type" },
                values: new object[,]
                {
                    { 500123456L, "Porto", "PT", "4000-000", "Rua A", "Acme", "Acme Shipping S.A.", "Owner" },
                    { 500123457L, "Lisboa", "PT", "1000-000", "Avenida B", "BlueOcean", "Blue Ocean Lda", "Operator" }
                });

            migrationBuilder.InsertData(
                table: "StorageAreas",
                columns: new[] { "Id", "CurrentOccupancyTEU", "DockDistances", "Location", "MaxCapacityTEU", "ServedDockIds", "Type" },
                values: new object[,]
                {
                    { 1, 200, "{}", "North Yard", 1000, "[]", 0 },
                    { 2, 120, "{}", "East Warehouse", 500, "[]", 1 }
                });

            migrationBuilder.InsertData(
                table: "VesselTypes",
                columns: new[] { "Id", "MaxBays", "MaxRows", "MaxTiers", "Capacity", "Description", "DockId", "Name" },
                values: new object[,]
                {
                    { 1L, 20, 12, 8, 50000, "Large cargo ship for containers", null, "Container Ship" },
                    { 2L, 25, 15, 9, 120000, "Carries liquids and oils", null, "Tanker" }
                });

            migrationBuilder.InsertData(
                table: "VesselVisitNotifications",
                columns: new[] { "Id", "AgentId", "ApprovedDockId", "ArrivalDate", "DecisionTimestamp", "DepartureDate", "OfficerId", "RejectionReason", "Status", "SubmissionTimestamp", "SubmittedByRepresentativeEmail", "SubmittedByRepresentativeName", "VesselId" },
                values: new object[,]
                {
                    { 1L, 1L, null, new DateTime(2025, 11, 16, 0, 0, 0, 0, DateTimeKind.Utc), null, null, null, null, "Pending", null, null, null, "1234567" },
                    { 2L, 2L, null, new DateTime(2025, 11, 23, 0, 0, 0, 0, DateTimeKind.Utc), null, null, null, null, "Pending", null, null, null, "7654321" }
                });

            migrationBuilder.InsertData(
                table: "Representative",
                columns: new[] { "Id", "CitizenID", "Email", "IsActive", "Name", "Nationality", "PhoneNumber", "ShippingAgentTaxNumber" },
                values: new object[,]
                {
                    { 1, "C12345", "joao.silva@acme.com", true, "João Silva", "PT", "+351900000000", 500123456L },
                    { 2, "C12346", "maria.costa@acme.com", true, "Maria Costa", "PT", "+351911111111", 500123456L },
                    { 3, "C22345", "pedro.azul@blueocean.com", true, "Pedro Azul", "PT", "+351922222222", 500123457L }
                });

            migrationBuilder.InsertData(
                table: "UserRoles",
                columns: new[] { "Id", "AppUserId", "RoleId" },
                values: new object[,]
                {
                    { 1, 1, 1 },
                    { 2, 2, 1 },
                    { 3, 3, 3 }
                });

            migrationBuilder.InsertData(
                table: "Vessels",
                columns: new[] { "Imo", "Name", "Operator", "VesselTypeId" },
                values: new object[,]
                {
                    { "1234567", "MV Example One", "Example Shipping Co", 1L },
                    { "7654321", "MT Sample Tanker", "Tankers Ltd", 2L }
                });

            migrationBuilder.CreateIndex(
                name: "IX_ContainerItem_VesselVisitNotificationId",
                table: "ContainerItem",
                column: "VesselVisitNotificationId");

            migrationBuilder.CreateIndex(
                name: "IX_CrewMember_VesselVisitNotificationId",
                table: "CrewMember",
                column: "VesselVisitNotificationId");

            migrationBuilder.CreateIndex(
                name: "IX_Representative_ShippingAgentTaxNumber",
                table: "Representative",
                column: "ShippingAgentTaxNumber");

            migrationBuilder.CreateIndex(
                name: "IX_ResourceQualifications_ResourceCode",
                table: "ResourceQualifications",
                column: "ResourceCode");

            migrationBuilder.CreateIndex(
                name: "IX_StaffQualifications_StaffMecanographicNumber",
                table: "StaffQualifications",
                column: "StaffMecanographicNumber");

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_AppUserId",
                table: "UserRoles",
                column: "AppUserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_RoleId",
                table: "UserRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_Vessels_VesselTypeId",
                table: "Vessels",
                column: "VesselTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_VesselTypes_DockId",
                table: "VesselTypes",
                column: "DockId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ContainerItem");

            migrationBuilder.DropTable(
                name: "CrewMember");

            migrationBuilder.DropTable(
                name: "Qualifications");

            migrationBuilder.DropTable(
                name: "Representative");

            migrationBuilder.DropTable(
                name: "ResourceAccessLogs");

            migrationBuilder.DropTable(
                name: "ResourceQualifications");

            migrationBuilder.DropTable(
                name: "SharedResources");

            migrationBuilder.DropTable(
                name: "StaffQualifications");

            migrationBuilder.DropTable(
                name: "StorageAreas");

            migrationBuilder.DropTable(
                name: "UserRoles");

            migrationBuilder.DropTable(
                name: "Vessels");

            migrationBuilder.DropTable(
                name: "VesselVisitNotifications");

            migrationBuilder.DropTable(
                name: "ShippingAgents");

            migrationBuilder.DropTable(
                name: "Resources");

            migrationBuilder.DropTable(
                name: "StaffMembers");

            migrationBuilder.DropTable(
                name: "AppUsers");

            migrationBuilder.DropTable(
                name: "Roles");

            migrationBuilder.DropTable(
                name: "VesselTypes");

            migrationBuilder.DropTable(
                name: "Docks");
        }
    }
}
