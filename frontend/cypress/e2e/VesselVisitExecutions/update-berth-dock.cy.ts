describe('Vessel Visit Executions - Update berth/dock', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin'],
  };

  const docksStub = [
    {
      id: 5,
      name: 'Alpha Dock',
      location: 'North Terminal',
      length: 320,
      depth: 15,
      maxDraft: 12,
      allowedVesselTypes: [],
    },
    {
      id: 12,
      name: 'Bravo Dock',
      location: 'South Terminal',
      length: 280,
      depth: 14,
      maxDraft: 11,
      allowedVesselTypes: [],
    },
  ];

  const vvnsStub = [
    {
      id: 450,
      vesselId: 'VES-450',
      agentId: 50,
      eta: '2024-03-20T07:30:00.000Z',
      arrivalDate: '2024-03-20T07:30:00.000Z',
      departureDate: '2024-03-22T16:00:00.000Z',
      status: 'Approved',
      approvedDockId: 5,
    },
  ];

  const berthDate = '2024-03-21';
  const berthTime = '11:45';
  const expectedBerthIso = new Date(`${berthDate}T${berthTime}`).toISOString();
  const newDockId = '12';

  const initialExecutions = [
    {
      id: 300,
      vesselVisitNotificationId: 450,
      vesselVisitId: 450,
      vesselName: 'Vessel Aurora',
      berthId: '5',
      status: 'in-progress',
      operationPlanId: null,
      plannedArrivalTime: '2024-03-20T07:20:00.000Z',
      actualArrivalTime: '2024-03-20T07:32:00.000Z',
      plannedBerthTime: null,
      actualBerthTime: null,
      actualUnberthTime: null,
      plannedDepartureTime: null,
      actualDepartureTime: null,
      totalTurnaroundMinutes: null,
      berthOccupancyMinutes: null,
      waitingForBerthMinutes: 25,
      arrivalDelayMinutes: 12,
      departureDelayMinutes: null,
      operationsDelayMinutes: null,
    },
  ];

  let executionsStub: typeof initialExecutions;

  beforeEach(() => {
    executionsStub = [...initialExecutions];

    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: userStub,
    }).as('authMe');

    cy.intercept('GET', '**/api/Docks*', {
      statusCode: 200,
      body: docksStub,
    }).as('loadDocks');

    cy.intercept('GET', '**/api/VesselVisitNotifications*', {
      statusCode: 200,
      body: vvnsStub,
    }).as('loadVvns');

    cy.intercept('GET', '**/api/oem/vessel-visit-executions*', (req) => {
      req.reply({
        statusCode: 200,
        body: executionsStub,
      });
    }).as('loadExecutions');

    cy.intercept('PATCH', '**/api/oem/vessel-visit-executions/*', (req) => {
      const id = Number(req.url.split('/').pop());
      expect(id).to.eq(initialExecutions[0].id);
      expect(req.body).to.deep.equal({
        actualBerthTime: expectedBerthIso,
        dockId: newDockId,
      });

      const updatedRecord = {
        ...executionsStub.find((exec) => exec.id === id)!,
        berthId: newDockId,
        actualBerthTime: expectedBerthIso,
      };

      executionsStub = executionsStub.map((exec) => (exec.id === id ? updatedRecord : exec));

      req.reply({
        statusCode: 200,
        body: updatedRecord,
      });
    }).as('updateBerth');

    cy.visit('/oem/vessel-visit-executions');
    cy.wait('@authMe');
    cy.wait('@loadDocks');
    cy.wait('@loadVvns');
    cy.wait('@loadExecutions');
  });

  it('updates berth time and dock for an execution', () => {
    cy.contains('tbody tr', 'Vessel Aurora').within(() => {
      cy.get('summary.action-menu-btn').click();
      cy.contains('button', 'Atualizar berth/dock').click();
    });

    cy.contains('section.action-panel', `Atualizar berth/dock · VVE ${initialExecutions[0].id}`)
      .should('be.visible')
      .within(() => {
        cy.get('input[formcontrolname="actualBerthDate"]').clear().type(berthDate);
        cy.get('input[formcontrolname="actualBerthTime"]').clear().type(berthTime);
        cy.get('select[formcontrolname="dockId"]').select('Dock 12 — Bravo Dock');
        cy.contains('button', 'Guardar alteracoes').click();
      });

    cy.wait('@updateBerth');
    cy.wait('@loadExecutions');

    cy.contains('section.action-panel', `Atualizar berth/dock · VVE ${initialExecutions[0].id}`)
      .should('not.exist');

    cy.contains('tbody tr', 'Vessel Aurora').within(() => {
      cy.get('td')
        .eq(3)
        .should(($cell) => {
          expect($cell.text().trim()).to.eq(newDockId);
        });
      cy.get('td').eq(6).should(($cell) => {
        expect($cell.text().trim()).to.not.equal('-');
      });
    });
  });
});
