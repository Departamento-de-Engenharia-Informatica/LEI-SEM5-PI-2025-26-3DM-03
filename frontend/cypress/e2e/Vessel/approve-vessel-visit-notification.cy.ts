describe('Vessel Visit Notifications - Create (Approve Flow)', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin'],
  };

  const docksStub = [
    { id: 12, name: 'Main Dock', location: 'Lisbon', maximumLength: 320, maximumDepth: 15, vesselTypeId: null },
  ];

  const vesselsStub = [
    { imo: '9876543', name: 'Atlas Trader', vesselTypeId: 1 },
  ];

  const vesselImo = '7654321';
  const agentTaxNumber = 500987654;
  const arrivalInput = '2025-06-10T08:00';
  const departureInput = '2025-06-12T20:00';
  const expectedArrivalIso = new Date(arrivalInput).toISOString();
  const expectedDepartureIso = new Date(departureInput).toISOString();
  const cargoCodes = ['OOLU1234567', 'TGHU7654321'];

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

    cy.intercept('GET', '**/api/Docks*', {
      statusCode: 200,
      body: docksStub,
    }).as('loadDocks');

    cy.intercept('GET', '**/api/Vessels*', {
      statusCode: 200,
      body: vesselsStub,
    }).as('loadVessels');

    cy.intercept('GET', '**/api/VesselVisitNotifications*', (req) => {
      req.reply({
        statusCode: 200,
        body: notificationsStub,
      });
    }).as('loadNotifications');

    cy.intercept('GET', /\/api\/VesselVisitNotifications\/(\d+)$/, (req) => {
      const match = req.url.match(/\/VesselVisitNotifications\/(\d+)$/);
      const id = match ? Number(match[1]) : null;
      const notification = notificationsStub.find((n) => n.id === id);
      if (!notification) {
        req.reply({ statusCode: 404, body: {} });
        return;
      }
      req.reply({ statusCode: 200, body: notification });
    }).as('getNotificationById');

    cy.intercept('POST', '**/api/VesselVisitNotifications', (req) => {
      expect(req.body).to.deep.equal({
        vesselId: vesselImo,
        agentId: agentTaxNumber,
        arrivalDate: expectedArrivalIso,
        departureDate: expectedDepartureIso,
        cargoManifest: cargoCodes.map((code) => ({ containerCode: code, isForUnloading: false })),
        crewMembers: [
          { name: 'Captain Green', citizenId: 'CAP987', nationality: 'PT' },
          { name: 'Officer Blue', citizenId: 'OFF654', nationality: 'FR' },
        ],
      });

      const created = {
        id: nextId++,
        vesselId: req.body.vesselId,
        agentId: req.body.agentId,
        arrivalDate: req.body.arrivalDate,
        departureDate: req.body.departureDate,
        status: 'InProgress',
        cargoManifest: cargoCodes,
        crewMembers: req.body.crewMembers,
        submissionTimestamp: null,
        approvedDockId: null,
        decisionTimestamp: null,
        rejectionReason: null,
        officerId: null,
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
      expect(existing, 'notification exists before submit').to.exist;

      const updated = {
        ...existing,
        status: 'Submitted',
        submissionTimestamp: new Date('2025-06-08T10:00:00Z').toISOString(),
      };

      notificationsStub = notificationsStub.map((n) => (n.id === id ? updated : n));

      req.reply({ statusCode: 200, body: {} });
    }).as('submitNotification');

    cy.intercept('POST', /\/api\/VesselVisitNotifications\/(\d+)\/approve\/(\d+)\/(\d+)$/, (req) => {
      const match = req.url.match(/\/VesselVisitNotifications\/(\d+)\/approve\/(\d+)\/(\d+)$/);
      const id = match ? Number(match[1]) : null;
      const dockId = match ? Number(match[2]) : null;
      const officerId = match ? Number(match[3]) : null;

      const existing = notificationsStub.find((n) => n.id === id);
      expect(existing, 'notification exists before approve').to.exist;

      const updated = {
        ...existing,
        status: 'Approved',
        approvedDockId: dockId,
        officerId,
        decisionTimestamp: new Date('2025-06-09T12:00:00Z').toISOString(),
      };

      notificationsStub = notificationsStub.map((n) => (n.id === id ? updated : n));

      req.reply({ statusCode: 200, body: {} });
    }).as('approveNotification');

    cy.visit('/vessel-visit-notifications');

    cy.wait('@authMe');
    cy.wait('@loadDocks');
    cy.wait('@loadVessels');
    cy.wait('@loadNotifications');
  });

  it('creates and approves a vessel visit notification', () => {
    cy.contains('button', 'Nova Notificação').click();

    cy.contains('h3', 'Criar VVN')
      .closest('section')
      .find('form')
      .within(() => {
        cy.get('input[name="imo"]').clear().type(vesselImo);
        cy.get('input[name="agent"]').clear().type(String(agentTaxNumber));
        cy.get('input[name="arr"]').clear().type(arrivalInput);
        cy.get('input[name="dep"]').clear().type(departureInput);
        cy.get('textarea[name="cargo"]').clear().type(cargoCodes.join(', '));
        cy.get('input[name="cap_name"]').clear().type('Captain Green');
        cy.get('input[name="cap_id"]').clear().type('CAP987');
        cy.get('input[name="cap_nat"]').clear().type('PT');
        cy.get('input[name="off1_name"]').clear().type('Officer Blue');
        cy.get('input[name="off1_id"]').clear().type('OFF654');
        cy.get('input[name="off1_nat"]').clear().type('FR');
        cy.contains('button', 'Criar').click();
      });

    cy.wait('@createNotification');
    cy.wait('@loadNotifications');

    cy.get('table.tbl tbody tr').should('have.length', 1);
    cy.get('table.tbl tbody tr').first().within(() => {
      cy.contains('td', vesselImo).scrollIntoView().should('contain.text', vesselImo);
      cy.contains('td', 'InProgress').scrollIntoView().should('contain.text', 'InProgress');
      cy.contains('span.badge', 'InProgress').should('be.visible');
      cy.get('button[title="Submeter"]').click();
    });

    cy.wait('@submitNotification');
    cy.wait('@getNotificationById');
    cy.wait('@loadNotifications');

    cy.get('table.tbl tbody tr').first().within(() => {
      cy.contains('span.badge', 'Submitted').scrollIntoView().should('exist');
      cy.get('button[title="Detalhes"]').click();
    });

    cy.wait('@getNotificationById');

    cy.get('.modal').within(() => {
      cy.get('select').first().scrollIntoView().should('contain', docksStub[0].name).select(docksStub[0].name);
      cy.get('input[placeholder="ex.: 42"]').scrollIntoView().clear({ force: true }).type('88', { force: true });
      cy.contains('button', 'Aprovar').scrollIntoView().click({ force: true });
    });

    cy.wait('@approveNotification');
    cy.wait('@getNotificationById');
    cy.wait('@loadNotifications');

    cy.get('.modal').within(() => {
      cy.contains('.status', 'Approved').should('be.visible');
      cy.contains('.value', String(docksStub[0].id)).should('be.visible');
      cy.contains('button', 'Fechar').scrollIntoView().click({ force: true });
    });

    cy.get('table.tbl tbody tr').first().within(() => {
      cy.contains('span.badge', 'Approved').scrollIntoView().should('contain.text', 'Approved');
    });
  });
});
