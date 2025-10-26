# DDD Glossary (Single Table)

| Term | Definition |
|---|---|
| AccessControl | Mechanism restricting access to system data or functions based on user roles. |
| Address | Postal address data of an organization (street, city, postal code, country). |
| Administrator | User responsible for managing system users, permissions, and configuration parameters. |
| Algorithm | Computational logic used to optimize dock assignment, scheduling, or resource allocation. |
| AuditLog | Record of significant actions and changes performed by users in the system. |
| AvailabilityStatus | Indicates the operational state of a resource. |
| Available | Staff member is available for work. |
| Backup | Copy of system data for recovery in case of failure. |
| bay | Lengthwise section index of the vessel’s container grid. |
| Berth | Physical position along a dock where a vessel is moored. |
| Berthing | Process of positioning a vessel at a specific berth for loading/unloading. |
| Bottleneck | Limiting factor (resource or staff shortage) that restricts operational throughput. |
| BusinessContinuity | Capability to sustain operations during disruptions or system outages. |
| Capacity | Maximum container carrying capacity, typically expressed in TEU. |
| CargoHandling | Overall process of loading, unloading, transporting, and storing cargo. |
| CargoManifest | Structured list of containers to unload or load for a vessel visit; primary input for operations planning. |
| CargoType | Classification of cargo content driving handling constraints and safety measures. |
| City | City of the address. |
| Compliance | Conformance to regulatory, safety, or operational standards. |
| Completed | Status value: the visit and its associated operations were executed and closed. |
| Configuration | Adjustable system parameters governing functionality and behavior. |
| Congestion | Condition where limited resources or space cause operational bottlenecks. |
| ContactInfo | Staff contact details including email and phone number. |
| Container | Standard ISO freight container referenced across manifests, yard, and operations. |
| ContainerSize | Container dimension class (e.g., modeled under TEU simplification in the prototype). |
| ContainerTransport | Movement of containers between port facilities using trucks or cranes. |
| ContainerWeight | Declared weight of the container and/or its contents. |
| ContainerYard | Port facility designated for stacking and temporary storage of containers. |
| Country | Country of the address. |
| CrewInfo | Minimal crew data attached to a visit for regulatory/operational needs. |
| crewCaptain | Captain’s name provided in the crew information. |
| CrewSize | Total number of crew members on board. |
| CurrentUtilization | Current occupancy/load of the storage area relative to its capacity. |
| Delay | Deviation from scheduled time due to operational inefficiencies or external factors. |
| Depth | Water depth at berth, constraining vessel draft. |
| DestinationOrCurrentLocation | Target destination (for loading) or current location (for unloading) of the container. |
| DisasterRecovery | Procedures allowing system restoration after severe failure or emergency. |
| Dock | Berthing location (quay) where vessels are assigned for (un)loading operations. |
| DockName | Human-readable name or label of a dock. |
| DockReassignment | Reallocation of a vessel to another dock due to maintenance or higher-priority arrivals. |
| DockAssignmentAlgorithm | Algorithm used by the Port Authority to assign docks efficiently to incoming vessels. |
| Documentation | Descriptive material (UML, C4 model, OpenAPI) explaining the system’s architecture and interfaces. |
| Electronics | Cargo type: electronic equipment requiring standard care and tracking. |
| Encryption | Security process used to protect sensitive information stored or transmitted in the system. |
| EntryNumber | Unique line identifier of a manifest entry. |
| EntryPosition | Container position on the vessel defined by bay, row, and tier. |
| EntryWeight | Declared weight of the cargo/container in the entry. |
| EnvironmentalCompliance | Adherence to environmental and sustainability standards in port operations. |
| Feasibility | Practical viability of an operation plan or system feature. |
| FixedCrane | Resource type representing a stationary crane installed at a dock (e.g., STS crane). |
| GeneralConsumerProducts | Cargo type: typical consumer goods without special handling beyond standards. |
| GDPRCompliance | Conformance with European General Data Protection Regulation regarding user data privacy and consent. |
| HandlingOperation | Any activity involving the movement or manipulation of cargo or containers. |
| HAZMAT | Cargo type: hazardous materials requiring designated safety officers and special handling. |
| IAMProvider | External identity provider (e.g., Google, Microsoft) used for authentication. |
| IMOnumber | International Maritime Organization unique identifier for a vessel. |
| Inactive | Resource is temporarily inactive or decommissioned. |
| Integration | Ability of the system to exchange information with other internal or external systems. |
| Interoperability | Compatibility of the system with external applications or standards. |
| IsoID | ISO 6346:2022 container identifier (owner code, category, serial, check digit). |
| Latency | Delay between request and response in system operations. |
| Length | Usable berth length relevant to vessel assignment. |
| LoadSequence | Ordered plan defining the order of container loading/unloading. |
| Loading | Manifest type indicating containers to be loaded onto the vessel before departure. |
| Location | Geographical or site location information for a dock or facility. |
| LogisticsOperator | User role responsible for defining, scheduling, and monitoring loading/unloading operations and resource allocation. |
| MaintenanceCall | Vessel visit involving maintenance only, without cargo operations. |
| MaintenancePeriod | Time window in which a resource is unavailable due to maintenance. |
| Maintainability | Ease of updating or modifying the system while preserving stability. |
| ManifestEntry | Single line item within a manifest describing one container and its handling intent. |
| ManifestType | Declares whether the manifest concerns unloading or loading. |
| ManifestWeight | Declared total weight of the manifest’s cargo (aggregated or per rules). |
| MaxBays | Upper bound of bays allowed by the vessel type. |
| MaxRows | Upper bound of rows allowed by the vessel type. |
| MaxTiers | Upper bound of tiers allowed by the vessel type. |
| MaxDraft | Maximum vessel draft supported by the dock. |
| MobileCrane | Resource type representing a movable crane used for container handling in yards or docks. |
| Monitoring | Continuous tracking of operations to ensure schedule adherence and detect deviations. |
| Module | Logical subdivision of system functionality. |
| MultilingualSupport | Capability of the system to operate in multiple languages (English and Portuguese required). |
| OperationalCapacity | Quantitative measure of a resource’s performance (e.g., containers/hour or containers/trip). |
| OperationalConstraint | Limitation such as dock capacity, vessel size, or resource availability that influences scheduling and planning. |
| OperationalEfficiency | Metric expressing how well port operations are executed relative to capacity and time. |
| OperationalPlanning | Combined activity of assigning docks, scheduling resources, and sequencing tasks for efficient vessel operations. |
| OperationalSafety | Set of regulations and measures ensuring safety during cargo handling. |
| OperationalScenario | A specific instance of port operation combining a vessel visit, assigned dock, and resource allocation. |
| OperationalStatus | Current operational condition of a dock, vessel, or resource during port activities. |
| OperationalWindow | Weekly time range during which a staff member is available for operations. |
| Operator | Shipping agent type: represents the vessel’s operating entity. |
| Optimization | Process of finding the most efficient solution for dock or resource allocation. |
| OversizedIndustrialEquipment | Cargo type: large equipment with special space/handling constraints. |
| Owner | Shipping agent type: represents the vessel’s owning entity. |
| Parameter | Individual configuration value controlling a specific aspect of the system. |
| Parallelization | Technique for performing independent tasks simultaneously to reduce overall operation time. |
| Performance | System’s speed and responsiveness under expected operational loads. |
| PersonalData | Any identifiable information about individuals, such as name, contact, or identification number. |
| Permission | Specific system privilege granted to a role or user. |
| Planning | Process of defining how resources and time slots are distributed among operations. |
| PortAuthorityOfficer | User role responsible for reviewing and approving or rejecting vessel visit notifications, assigning docks, and overseeing port operations. |
| PortFacility | General infrastructure element within a port, such as docks, yards, or warehouses. |
| PostalCode | Postal or ZIP code of the address. |
| Prototype | Simplified but functional version of the system demonstrating feasibility. |
| Quay | Synonym for dock; structure where vessels berth. |
| Qualification | Certification or skill authorizing a staff member to operate specific resources. |
| QualificationCode | Unique code identifying a qualification. |
| QualificationDescription | Description of the qualification, e.g., STS Crane Operator or Truck Driver. |
| Reliability | System’s capacity to perform consistently and correctly over time. |
| Representative | Individual authorized by the shipping agent to interact with the system. |
| RepresentativeName | Full name of a shipping agent representative. |
| RepresentativeNationality | Declared nationality of the representative. |
| RepresentativePhoneNumber | Phone contact of the representative. |
| Resource | Any physical logistic asset (crane, truck, etc.) used in port operations and managed by the system. |
| ResourceConstraint | Limitation related to the availability, capacity, or maintenance of a resource. |
| ResourceDescription | Textual description detailing the resource’s purpose or specifications. |
| ResourceSchedulingAlgorithm | Algorithm used by the Logistics Operator to allocate and schedule resources and staff. |
| ResourceType | Categorization of the resource based on its physical nature or function. |
| ResourceUtilization | Measure of how effectively resources are being used during operations. |
| Responsiveness | System’s ability to react quickly and correctly to user input or data changes. |
| RESTful API | Standard interface for external system communication based on REST principles. |
| RetentionPolicy | Rule defining how long operational or personal data are stored before deletion. |
| Rejected | Status value: the notification was refused (e.g., missing docs or dock unavailability). |
| RefrigeratedGoods | Cargo type: temperature-controlled goods (reefers). |
| Reliability | System’s ability to perform consistently and correctly over time. |
| Representative | Person acting on behalf of a shipping agent within the system. |
| SafetyOfficer | Crew member certified to handle hazardous cargo operations (HAZMAT). |
| Scalability | System’s ability to handle increasing loads or concurrent users efficiently. |
| ScheduledArrival | Estimated time of arrival (ETA) for the vessel visit. |
| ScheduledDeparture | Estimated time of departure (ETD) for the vessel visit. |
| Scheduling | Process of planning and ordering port operations (arrivals, departures, tasks). |
| SchedulingAlgorithm | Algorithm used to plan dock assignments or task sequencing based on constraints and optimization goals. |
| SecurityPolicy | Set of system rules ensuring confidentiality, integrity, and availability of information. |
| Session | Logical connection representing an authenticated user’s active interaction with the system. |
| SetupTime | Preparation time required before a resource becomes operational (e.g., calibration or refueling). |
| Shift | Defined working period for staff or resource operation. |
| ShippingAgent | Organization representing the vessel owner/operator in port interactions. |
| ShippingAgentName | Registered name of the shipping agent organization. |
| ShippingAgentType | Indicates whether the agent acts as Owner or Operator representative. |
| ShippingAgentRepresentative | User role representing a shipping agent; responsible for submitting vessel visit notifications and cargo manifests. |
| StaffMember | Registered port staff responsible for operating equipment or performing logistics tasks. |
| StaffName | Short or full name used to identify a staff member. |
| StaffStatus | Indicates the availability of a staff member for assignment. |
| STS Crane | Fixed ship-to-shore crane mounted at docks for loading/unloading vessels. |
| StorageArea | Facility area for temporary storage/handling (yard or warehouse). |
| StorageAreaCapacity | Capacity of the storage area (e.g., by container count/TEU). |
| StorageAreaID | Unique identifier of a storage area. |
| StorageAreaType | Classification of storage facilities as Yard or Warehouse. |
| StorageLocation | Specific location reference within a storage area. |
| street | Street line of the address. |
| Sustainability | Adherence to environmentally friendly and resource-efficient practices in operations. |
| SystemUser | Any authenticated individual interacting with the system according to their assigned role. |
| Task | A unit of work such as unloading, transporting, or stacking containers. |
| TaskAdjustment | Modification of a previously scheduled task due to operational changes. |
| TaskDependency | Logical rule defining that one task cannot start until another is completed. |
| TaskExecution | Actual performance of an operational task in the port. |
| TaskSequencing | Planning step determining the order of loading/unloading tasks considering dependencies and parallelization. |
| TaxNumber | Fiscal/taxpayer number used for legal and billing identification. |
| TEU | Standard unit used to describe vessel and container capacity equivalent to one 20-foot container. |
| TerminalTruck | Internal vehicle used to move containers between docks, yards, and warehouses. |
| ThroughputRate | Quantitative measure of cargo processed per time unit (e.g., containers/hour). |
| Tier | Vertical stack index of the vessel’s container grid. |
| TimeWindow | Period during which an operation, resource, or staff is available. |
| Traceability | Ability to track actions, operations, and data changes for auditing and debugging purposes. |
| Truck | Resource type representing a terminal truck or tractor for container transport between docks, yards, or warehouses. |
| TurnaroundTime | Total duration between vessel arrival and departure, reflecting operational performance. |
| TypeDescription | Descriptive name or label of a vessel type. |
| TypeName | Technical identifier name of a vessel type. |
| Unavailable | Staff member is on leave, in training, or otherwise not available. |
| Unberthing | Process of detaching a vessel from a berth for departure. |
| UnderMaintenance | Resource is undergoing maintenance and cannot be assigned. |
| Unloading | Manifest type indicating containers to be discharged from the vessel on arrival. |
| Usability | Degree to which the system is intuitive, consistent, and easy to use by different roles. |
| User | Any authenticated individual interacting with the system according to their assigned role. |
| UserAuthentication | Process verifying the user’s identity, relying on an external IAM provider. |
| UserAuthorization | Process determining which system features and data a user can access based on their role. |
| VesselBays | Maximum number of lengthwise container bays supported by the vessel. |
| VesselName | Official name of the vessel. |
| VesselRecord | System record representing a container-carrying vessel managed by the port. |
| VesselRows | Maximum number of across-ship container rows supported by the vessel. |
| VesselTiers | Maximum number of vertical container tiers (above/below deck) supported by the vessel. |
| VesselTurnaround | Total time from a vessel’s arrival to its departure, key indicator of port performance. |
| VesselType | Classification of a vessel that constrains its grid (rows, bays, tiers) and TEU capacity. |
| VesselVisitNotification | Submitted request describing a planned vessel call, used to approve or reject a visit and to trigger dock assignment and operations planning. |
| Warehouse | Indoor storage facility for cargo requiring inspection, consolidation, or repackaging. |
| Web Interface | Browser-based user interface of the system. |
| Yard | Outdoor storage area for containers awaiting further handling or transport. |
| YardGantryCrane | Mobile crane operating within a yard to stack and retrieve containers. |
