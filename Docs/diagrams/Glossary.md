# Glossary

## VesselAggregate

- **VesselRecord** *(Aggregate Root, Entity)* — Registered vessel that aggregates identification and structural layout, and references a vessel type.
- **IMOnumber** *(Value Object)* — Vessel’s IMO identifier.
- **VesselName** *(Value Object)* — Vessel’s name.
- **VesselRows** *(Value Object)* — Number of rows in the vessel’s container grid.
- **VesselBays** *(Value Object)* — Number of bays in the vessel’s container grid.
- **VesselTiers** *(Value Object)* — Number of tiers in the vessel’s container grid.
- **VesselTypeId** *(Value Object)* — Identifier of the associated vessel type.

---

## VesselTypeAggregate

- **VesselType** *(Aggregate Root, Entity)* — Classification describing constraints and characteristics of vessels.
- **VesselTypeId** *(Value Object)* — Unique vessel type identifier.
- **TypeName** *(Value Object)* — Name of the vessel type.
- **TypeDescription** *(Value Object)* — Optional descriptive text for the vessel type.
- **Capacity** *(Value Object)* — Capacity attributed to the vessel type.
- **MaxRows** *(Value Object)* — Maximum allowed rows for vessels of this type.
- **MaxBays** *(Value Object)* — Maximum allowed bays for vessels of this type.
- **MaxTiers** *(Value Object)* — Maximum allowed tiers for vessels of this type.

---

## VesselVisitAggregate

- **VesselVisitNotification** *(Aggregate Root, Entity)* — Notification of a planned vessel visit.
- **VisitID** *(Value Object)* — Unique identifier for a visit notification.
- **ScheduledArrival** *(Value Object)* — Planned arrival time.
- **ScheduledDeparture** *(Value Object)* — Planned departure time.
- **Status** *(Value Object, Enum)* — Visit state:
  - **Pending**
  - **Rejected**
  - **Approved**
  - **Completed**
- **CrewInfo** *(Value Object)* — Crew details:
  - **crewCaptain**
  - **crewSize**
  - **crewNationality**

---

## CargoManifestAggregate

- **CargoManifest** *(Aggregate Root, Entity)* — Manifest describing cargo associated with a visit.
- **ManifestType** *(Value Object, Enum)* — Manifest nature:
  - **Loading**
  - **Unloading**
- **ManifestID** *(Value Object)* — Unique manifest identifier.
- **ManifestWeight** *(Value Object)* — Total weight for the manifest.
- **ManifestEntry** *(Entity)* — Single cargo line within a manifest.
- **EntryID** *(Value Object)* — Unique identifier for a manifest entry.
- **EntryWeight** *(Value Object)* — Weight associated with the entry.
- **EntryPosition** *(Value Object)* — Position on vessel:
  - **bay**
  - **row**
  - **tier**
- **DestinationOrCurrentLocation** *(Value Object)* — Destination (for loading) or current storage location (for unloading).
- **CargoType** *(Value Object, Enum)* — Cargo classification:
  - **HAZMAT**
  - **RefrigeratedGoods**
  - **GeneralConsumerProducts**
  - **Electronics**
  - **OversizedIndustrialEquipment**
- **Container** *(Entity)* — Container unit referenced by entries.
- **ContainerID** *(Value Object)* — Container identifier.
- **IsoID** *(Value Object)* — ISO container code.
- **ContainerSize** *(Value Object)* — Container size classification.
- **ContainerWeight** *(Value Object)* — Container weight.

---

## StaffAggregate

- **StaffMember** *(Aggregate Root, Entity)* — Registered staff member for port operations.
- **StaffID** *(Value Object)* — Staff identifier.
- **StaffName** *(Value Object)* — Staff member’s name.
- **ContactInfo** *(Value Object)* — Contact details:
  - **email**
  - **phoneNumber**
- **OperationalWindow** *(Value Object)* — Availability interval:
  - **startTime**
  - **endTime**
- **StaffStatus** *(Value Object, Enum)* — Availability state:
  - **Available**
  - **Unavailable**

---

## QualificationAggregate

- **Qualification** *(Aggregate Root, Entity)* — Certification/skill used for assignments.
- **QualificationCode** *(Value Object)* — Unique qualification code.
- **QualificationDescription** *(Value Object)* — Optional descriptive text for the qualification.

---

## ResourceAggregate

- **Resource** *(Aggregate Root, Entity)* — Physical equipment used in operations.
- **ResourceID** *(Value Object)* — Resource identifier.
- **ResourceDescription** *(Value Object)* — Human-readable description of the resource.
- **OperationalCapacity** *(Value Object)* — Capacity/throughput measure for the resource.
- **AvailabilityStatus** *(Value Object, Enum)* — Operability state:
  - **Active**
  - **Inactive**
  - **UnderMaintenance**
- **ResourceType** *(Value Object, Enum)* — Resource category:
  - **MobileCrane**
  - **FixedCrane**
  - **Truck**
- **ResourceOperationalWindow** *(Value Object)* — Weekly availability definition:
  - **dayOfWeek**
  - **startTime**
  - **endTime**

---

## DockAggregate

- **Dock** *(Aggregate Root, Entity)* — Berth where vessels are moored for operations.
- **DockID** *(Value Object)* — Dock identifier.
- **DockName** *(Value Object)* — Name/label of the dock.
- **Location** *(Value Object)* — Dock location.
- **Length** *(Value Object)* — Dock length.
- **Depth** *(Value Object)* — Water depth at the dock.
- **MaxDraft** *(Value Object)* — Maximum allowed vessel draft.
- **AllowedVesselType** *(Entity)* — Permission link to a vessel type:
  - **vesselTypeId : VesselTypeId**

---

## StorageAreaAggregate

- **StorageArea** *(Aggregate Root, Entity)* — Area used for storage and logistics.
- **StorageAreaID** *(Value Object)* — Storage area identifier.
- **StorageAreaType** *(Value Object, Enum)* — Area classification:
  - **Yard**
  - **Warehouse**
- **StorageLocation** *(Value Object)* — Storage area location.
- **StorageAreaCapacity** *(Value Object)* — Maximum capacity of the storage area.
- **CurrentUtilization** *(Value Object)* — Current usage/occupancy.

---

## ShippingOrganizationAggregate

- **ShippingAgent** *(Aggregate Root, Entity)* — Organization representing the vessel owner/operator.
- **ShippingAgentName** *(Value Object)* — Organization name.
- **TaxNumber** *(Value Object)* — Organization tax number.
- **ShippingAgentType** *(Value Object, Enum)* — Role:
  - **Owner**
  - **Operator**
- **Address** *(Value Object)* — Organization address:
  - **street**
  - **city**
  - **postalCode**
  - **country**
- **Representative** *(Entity)* — Individual acting on behalf of the shipping agent.
- **RepresentativeName** *(Value Object)* — Representative’s name.
- **RepresentativeCitizenID** *(Value Object)* — Citizen identification number.
- **RepresentativeNationality** *(Value Object)* — Representative’s nationality.
- **RepresentativeEmail** *(Value Object)* — Representative’s email.
- **RepresentativePhoneNumber** *(Value Object)* — Representative’s phone number.
