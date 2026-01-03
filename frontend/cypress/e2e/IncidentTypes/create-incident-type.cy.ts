describe('Incident Types - Create', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin'],
  };

  const initialIncidentTypes = [
    {
      id: 10,
      code: 'MAINT-BASE',
      name: 'Maintenance Alert',
      severity: 'MINOR',
      description: 'Routine maintenance follow-up',
      parentId: null,
      createdAt: '2024-03-12T08:00:00.000Z',
      updatedAt: null,
    },
    {
      id: 11,
      code: 'SAFETY-CRIT',
      name: 'Safety Critical',
      severity: 'CRITICAL',
      description: 'Critical safety breach',
      parentId: null,
      createdAt: '2024-03-15T09:30:00.000Z',
      updatedAt: null,
    },
  ];

  const newIncident = {
    code: 'OPS-MAJOR',
    name: 'Operations Impact',
    severity: 'MAJOR',
    description: 'Major impact on operations',
  };

  const expectedTotal = initialIncidentTypes.length + 1;

  let incidentTypesStub: typeof initialIncidentTypes;

  beforeEach(() => {
    incidentTypesStub = [...initialIncidentTypes];

    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: userStub,
    }).as('authMe');

    cy.intercept('GET', '**/api/oem/incident-types*', (req) => {
      req.reply({
        statusCode: 200,
        body: incidentTypesStub,
      });
    }).as('loadIncidentTypes');

    cy.intercept('POST', '**/api/oem/incident-types', (req) => {
      expect(req.body).to.deep.equal({
        code: newIncident.code,
        name: newIncident.name,
        severity: newIncident.severity,
        description: newIncident.description,
        parentId: null,
      });

      const created = {
        id: 99,
        code: newIncident.code,
        name: newIncident.name,
        severity: newIncident.severity,
        description: newIncident.description,
        parentId: null,
        createdAt: '2024-03-20T10:00:00.000Z',
        updatedAt: null,
      };

      incidentTypesStub = [created, ...incidentTypesStub];

      req.reply({
        statusCode: 201,
        body: created,
      });
    }).as('createIncidentType');

    cy.visit('/incident-types');
    cy.wait('@authMe');
    cy.wait('@loadIncidentTypes');
  });

  it('creates a new incident type and shows it in the list', () => {
    cy.get('aside.forms-panel section.card form').within(() => {
      cy.get('input[name="code"]').clear().type(newIncident.code);
      cy.get('input[name="name"]').clear().type(newIncident.name);
      cy.get('select[name="severity"]').select(newIncident.severity);
      cy.get('select[name="create-parent"]').select('Nenhum (raiz)');
      cy.get('textarea[name="description"]').clear().type(newIncident.description);

      cy.contains('button', 'Criar').click();
    });

    cy.wait('@createIncidentType');
    cy.wait('@loadIncidentTypes');

    cy.get('table tbody tr').should('have.length', expectedTotal);
    cy.contains('table tbody tr', newIncident.code).within(() => {
      cy.get('td').eq(0).should('have.text', newIncident.code);
      cy.get('td').eq(1).should('have.text', newIncident.name);
      cy.get('td').eq(2).should('contain.text', newIncident.severity);
    });

    cy.get('aside.forms-panel section.card form').within(() => {
      cy.get('input[name="code"]').should('have.value', '');
      cy.get('input[name="name"]').should('have.value', '');
      cy.get('textarea[name="description"]').should('have.value', '');
    });
  });
});
