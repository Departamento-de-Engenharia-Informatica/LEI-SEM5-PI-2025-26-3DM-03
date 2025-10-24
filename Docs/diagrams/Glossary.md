# DDD Glossary (Single Table)

| Aggregate | Term | Type | Description |
|------------|------|------|--------------|
| VesselAggregate | VesselRecord | Aggregate Root, Entity | Registered vessel that aggregates identification and structural layout, and references a vessel type. |
| VesselAggregate | IMOnumber | Value Object | Vessel’s IMO identifier. |
| VesselAggregate | VesselName | Value Object | Vessel’s name. |
| VesselAggregate | VesselRows | Value Object | Number of rows in the vessel’s container grid. |
| VesselAggregate | VesselBays | Value Object | Number of bays in the vessel’s contai
ner grid. |
| VesselAggregate | VesselTiers | Value Object | Number of tiers in the vessel’s container grid. |
| VesselAggregate | VesselTypeId | Value Object | Identifier of the associated vessel type. |
| VesselTypeAggregate | VesselType | Aggregate Root, Entity | Classification describing constraints and characteristics of vessels. |
| VesselTypeAggregate | VesselTypeId | Value Object | Unique vessel type identifier. |
| VesselTypeAggregate | TypeName | Value Object | Name of the vessel type. |
| VesselTypeAggregate | TypeDescription | Value Object | Optional descriptive text for the vessel type. |
| VesselTypeAggregate | Capacity | Value Object | Capacity attributed to the vessel type. |
| VesselTypeAggregate | MaxRows | Value Object | Maximum allowed rows for vessels of this type. |
| VesselTypeAggregate | MaxBays | Value Object | Maximum allowed bays for vessels of this type. |
| VesselTypeAggregate | MaxTiers | Value Object | Maximum allowed tiers for vessels of this type. |
| VesselVisitAggregate | VesselVisitNotification | Aggregate Root, Entity | Notification of a planned vessel visit. |
| VesselVisitAggregate | VisitID | Value Object | Unique identifier for a visit notification. |
| VesselVisitAggregate | ScheduledArrival | Value Object | Planned arrival time. |
| VesselVisitAggregate | ScheduledDeparture | Value Object | Planned departure time. |
| VesselVisitAggregate | Status | Value Object, Enum | Visit state: Pending, Rejected, Approved, Completed. |
| VesselVisitAggregate | CrewInfo | Value Object | Crew details: crewCaptain, crewSize, crewNationality. |
| CargoManifestAggregate | CargoManifest | Aggregate Root, Entity | Manifest describing cargo associated with a visit. |
| CargoManifestAggregate | ManifestType | Value Object, Enum | Manifest nature: Loading, Unloading. |
| CargoManifestAggregate | ManifestID | Value Object | Unique manifest identifier. |
| CargoManifestAggregate | ManifestWeight | Value Object | Total weight for the manifest. |
| CargoManifestAggregate | ManifestEntry | Entity | Single cargo line within a manifest. |
| CargoManifestAggregate | EntryID | Value Object | Unique identifier for a manifest entry. |
| CargoManifestAggregate | EntryWeight | Value Object | Weight associated with the entry. |
| CargoManifestAggregate | EntryPosition | Value Object | Position on vessel: bay, row, tier. |
| CargoManifestAggregate | DestinationOrCurrentLocation | Value Object | Destination (for loading) or current storage location (for unloading). |
| CargoManifestAggregate | CargoType | Value Object, Enum | Cargo classification: HAZMAT, RefrigeratedGoods, GeneralConsumerProducts, Electronics, OversizedIndustrialEquipment. |
| CargoManifestAggregate | Container | Entity | Container unit referenced by entries. |
| CargoManifestAggregate | ContainerID | Value Object | Container identifier. |
| CargoManifestAggregate | IsoID | Value Object | ISO container code. |
| CargoManifestAggregate | ContainerSize | Value Object | Container size classification. |
| CargoManifestAggregate | ContainerWeight | Value Object | Container weight. |
| StaffAggregate | StaffMember | Aggregate Root, Entity | Registered staff member for port operations. |
| StaffAggregate | StaffID | Value Object | Staff identifier. |
| StaffAggregate | StaffName | Value Object | Staff member’s name. |
| StaffAggregate | ContactInfo | Value Object | Contact details: email, phoneNumber. |
| StaffAggregate | OperationalWindow | Value Object | Availability interval: startTime, endTime. |
| StaffAggregate | StaffStatus | Value Object, Enum | Availability state: Available, Unavailable. |
| QualificationAggregate | Qualification | Aggregate Root, Entity | Certification/skill used for assignments. |
| QualificationAggregate | QualificationCode | Value Object | Unique qualification code. |
| QualificationAggregate | QualificationDescription | Value Object | Optional descriptive text for the qualification. |
| ResourceAggregate | Resource | Aggregate Root, Entity | Physical equipment used in operations. |
| ResourceAggregate | ResourceID | Value Object | Resource identifier. |
| ResourceAggregate | ResourceDescription | Value Object | Human-readable description of the resource. |
| ResourceAggregate | OperationalCapacity | Value Object | Capacity/throughput measure for the resource. |
| ResourceAggregate | AvailabilityStatus | Value Object, Enum | Operability state: Active, Inactive, UnderMaintenance. |
| ResourceAggregate | ResourceType | Value Object, Enum | Resource category: MobileCrane, FixedCrane, Truck. |
| ResourceAggregate | ResourceOperationalWindow | Value Object | Weekly availability definition: dayOfWeek, startTime, endTime. |
| DockAggregate | Dock | Aggregate Root, Entity | Berth where vessels are moored for operations. |
| DockAggregate | DockID | Value Object | Dock identifier. |
| DockAggregate | DockName | Value Object | Name/label of the dock. |
| DockAggregate | Location | Value Object | Dock location. |
| DockAggregate | Length | Value Object | Dock length. |
| DockAggregate | Depth | Value Object | Water depth at the dock. |
| DockAggregate | MaxDraft | Value Object | Maximum allowed vessel draft. |
| DockAggregate | AllowedVesselType | Entity | Permission link to a vessel type (vesselTypeId : VesselTypeId). |
| StorageAreaAggregate | StorageArea | Aggregate Root, Entity | Area used for storage and logistics. |
| StorageAreaAggregate | StorageAreaID | Value Object | Storage area identifier. |
| StorageAreaAggregate | StorageAreaType | Value Object, Enum | Area classification: Yard, Warehouse. |
| StorageAreaAggregate | StorageLocation | Value Object | Storage area location. |
| StorageAreaAggregate | StorageAreaCapacity | Value Object | Maximum capacity of the storage area. |
| StorageAreaAggregate | CurrentUtilization | Value Object | Current usage/occupancy. |
| ShippingOrganizationAggregate | ShippingAgent | Aggregate Root, Entity | Organization representing the vessel owner/operator. |
| ShippingOrganizationAggregate | ShippingAgentName | Value Object | Organization name. |
| ShippingOrganizationAggregate | TaxNumber | Value Object | Organization tax number. |
| ShippingOrganizationAggregate | ShippingAgentType | Value Object, Enum | Role: Owner, Operator. |
| ShippingOrganizationAggregate | Address | Value Object | Organization address: street, city, postalCode, country. |
| ShippingOrganizationAggregate | Representative | Entity | Individual acting on behalf of the shipping agent. |
| ShippingOrganizationAggregate | RepresentativeName | Value Object | Representative’s name. |
| ShippingOrganizationAggregate | RepresentativeCitizenID | Value Object | Citizen identification number. |
| ShippingOrganizationAggregate | RepresentativeNationality | Value Object | Representative’s nationality. |
| ShippingOrganizationAggregate | RepresentativeEmail | Value Object | Representative’s email. |
| ShippingOrganizationAggregate | RepresentativePhoneNumber | Value Object | Representative’s phone number. |
