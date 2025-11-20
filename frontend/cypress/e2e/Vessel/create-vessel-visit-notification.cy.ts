describe('Vessel Visit Notifications - Create/Submit/Approve', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin', 'agent'],
  };

  const vesselImo = '1234567';
  const vesselName = 'Cypress Runner';
  const agentTaxNumber = 500123456;
  const arrivalInput = '2025-05-12T09:00';
  const departureInput = '2025-05-15T18:00';
  const expectedArrivalIso = new Date(arrivalInput).toISOString();
  const expectedDepartureIso = new Date(departureInput).toISOString();
  const cargoCodes = ['MSKU1234567', 'TRIU7654321'];
  const officerId = 42;

  const docksStub = [
    { id: 10, name: 'Main Dock', location: 'Lisbon', maximumLength: 300, maximumDepth: 15, vesselTypeId: null },
  ];

  const vesselsStub = [
    { id: 'v1', imo: vesselImo, name: vesselName, vesselTypeId: 1 },
  ];

  let notificationsStub: any[];
  let nextId: number;

  beforeEach(() => {
    notificationsStub = [];
    nextId = 1;

    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: userStub,
    }).as('authMe');

    cy.intercept('GET', '**/api/Vessels*', {
      statusCode: 200,
      body: vesselsStub,
    }).as('loadVessels');

    cy.intercept('GET', '**/api/Docks*', {
      statusCode: 200,
      body: docksStub,
    }).as('loadDocks');

    cy.intercept('GET', /\/api\/VesselVisitNotifications(\?.*)?$/, (req) => {
      req.reply({
        statusCode: 200,
        body: notificationsStub,
      });
    }).as('getNotifications');

    cy.intercept('GET', /\/api\/VesselVisitNotifications\/(\d+)$/, (req) => {
      const match = req.url.match(/\/VesselVisitNotifications\/(\d+)$/);
      const id = match ? Number(match[1]) : null;
      const notification = notificationsStub.find((n) => n.id === id);
      if (!notification) {
        req.reply({ statusCode: 404, body: {} });
        return;
      }
      req.reply({
        statusCode: 200,
        body: notification,
      });
    }).as('getNotificationById');

    cy.intercept('POST', '**/api/VesselVisitNotifications', (req) => {
      expect(req.body).to.deep.equal({
        vesselId: vesselImo,
        agentId: agentTaxNumber,
        arrivalDate: expectedArrivalIso,
        departureDate: expectedDepartureIso,
        cargoManifest: cargoCodes.map((code) => ({ containerCode: code, isForUnloading: false })),
        crewMembers: [
          { name: 'Captain Test', citizenId: 'CPT123', nationality: 'PT' },
          { name: 'Officer Test', citizenId: 'OFF456', nationality: 'ES' },
        ],
      });

      const created = {
        id: nextId++,
        vesselId: req.body.vesselId,
        agentId: req.body.agentId,
        arrivalDate: req.body.arrivalDate,
        departureDate: req.body.departureDate,
        cargoManifest: req.body.cargoManifest?.map((item: any) => item.containerCode) ?? [],
        crewMembers: req.body.crewMembers,
        status: 'InProgress',
        submissionTimestamp: null,
        approvedDockId: null,
        rejectionReason: null,
      };

      notificationsStub = [created, ...notificationsStub];

      req.reply({
        statusCode: 201,
        body: created,
      });
    }).as('createNotification');

    cy.intercept('POST', /\/api\/VesselVisitNotifications\/(\d+)\/submit$/, (req) => {
      const match = req.url.match(/\/VesselVisitNotifications\/(\d+)\/submit$/);
      const id = match ? Number(match[1]) : null;
      const existing = notificationsStub.find((n) => n.id === id);
      expect(existing, 'existing notification before submit').to.exist;

      const updated = {
        ...existing,
        status: 'Submitted',
        submissionTimestamp: new Date('2025-05-10T10:00:00Z').toISOString(),
      };

      notificationsStub = notificationsStub.map((n) => (n.id === id ? updated : n));

      req.reply({ statusCode: 200, body: {} });
    }).as('submitNotification');

    cy.intercept('POST', /\/api\/VesselVisitNotifications\/(\d+)\/approve\/(\d+)\/(\d+)$/, (req) => {
      const match = req.url.match(/\/VesselVisitNotifications\/(\d+)\/approve\/(\d+)\/(\d+)$/);
      const id = match ? Number(match[1]) : null;
      const dockId = match ? Number(match[2]) : null;
      const officer = match ? Number(match[3]) : null;

      expect(dockId).to.equal(docksStub[0].id);
      expect(officer).to.equal(officerId);

      const existing = notificationsStub.find((n) => n.id === id);
      expect(existing, 'existing notification before approve').to.exist;

      const updated = {
        ...existing,
        status: 'Approved',
        approvedDockId: dockId,
        officerId: officer,
        decisionTimestamp: new Date('2025-05-11T09:00:00Z').toISOString(),
      };

      notificationsStub = notificationsStub.map((n) => (n.id === id ? updated : n));

      req.reply({ statusCode: 200, body: {} });
    }).as('approveNotification');

    cy.visit('/vessel-visit-notifications');

    cy.wait('@authMe');
    cy.wait('@loadVessels');
    cy.wait('@loadDocks');
    cy.wait('@getNotifications');
  });

  it('creates, submits, and approves a notification', () => {
    cy.contains('h1', 'Vessel Visit Notifications').should('be.visible');

    cy.contains('button', 'Nova').click();

    cy.get('form.form-grid').within(() => {
      cy.get('input[name="imo"]').clear().type(vesselImo);
      cy.get('input[name="agent"]').clear().type(String(agentTaxNumber));
      cy.get('input[name="arr"]').clear().type(arrivalInput);
      cy.get('input[name="dep"]').clear().type(departureInput);
      cy.get('textarea[name="cargo"]').clear().type(cargoCodes.join(', '));
      cy.get('input[name="cap_name"]').clear().type('Captain Test');
      cy.get('input[name="cap_id"]').clear().type('CPT123');
      cy.get('input[name="cap_nat"]').clear().type('PT');
      cy.get('input[name="off1_name"]').clear().type('Officer Test');
      cy.get('input[name="off1_id"]').clear().type('OFF456');
      cy.get('input[name="off1_nat"]').clear().type('ES');
      cy.contains('button', 'Criar').click();
    });

    cy.wait('@createNotification');
    cy.wait('@getNotifications');

    cy.get('table.tbl tbody tr').should('have.length', 1);
    cy.get('table.tbl tbody tr').first().within(() => {
      cy.contains('td', vesselImo).should('be.visible');
      cy.contains('span.badge', 'InProgress').should('be.visible');
    });

    cy.get('table.tbl tbody tr').first().within(() => {
      cy.get('button[title="Submeter"]').click();
    });

    cy.wait('@submitNotification');
    cy.wait('@getNotificationById');
    cy.wait('@getNotifications');

    cy.get('table.tbl tbody tr').first().within(() => {
      cy.contains('span.badge', 'Submitted').should('be.visible');
    });

    cy.get('table.tbl tbody tr').first().within(() => {
      cy.get('button[title="Detalhes"]').click();
    });

    cy.wait('@getNotificationById');

    cy.get('.modal').within(() => {
      cy.get('select').first().select(String(docksStub[0].id));
      cy.get('input[placeholder="OfficerId"]').clear().type(String(officerId));
      cy.contains('button', 'Aprovar').click();
    });

    cy.wait('@approveNotification');
    cy.wait('@getNotificationById');
    cy.wait('@getNotifications');

    cy.get('.modal').within(() => {
      cy.contains('.status', 'Approved').should('be.visible');
      cy.contains('.value', String(docksStub[0].id)).should('exist');
      cy.contains('button', 'Fechar').click();
    });

    cy.get('table.tbl tbody tr').first().within(() => {
      cy.contains('span.badge', 'Approved').should('be.visible');
      cy.get('td').eq(4).should('contain', docksStub[0].id);
    });
  });
});
