describe('Incident Types - Edit', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin'],
  };

  const initialIncidentTypes = [
    {
      id: 20,
      code: 'OPS-MIN',
      name: 'Operations Minor',
      severity: 'MINOR',
      description: 'Low impact operations issue',
      parentId: null,
      createdAt: '2024-03-10T09:00:00.000Z',
      updatedAt: null,
    },
    {
      id: 21,
      code: 'SAF-MAJ',
      name: 'Safety Major',
      severity: 'MAJOR',
      description: 'High priority safety incident',
      parentId: null,
      createdAt: '2024-03-11T11:30:00.000Z',
      updatedAt: null,
    },
  ];

  const updatedIncident = {
    code: 'OPS-CRIT',
    name: 'Operations Critical',
    severity: 'CRITICAL',
    description: 'Critical incident affecting operations',
  };

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

    cy.intercept('PATCH', '**/api/oem/incident-types/*', (req) => {
      expect(req.body).to.deep.equal({
        code: updatedIncident.code,
        name: updatedIncident.name,
        severity: updatedIncident.severity,
        description: updatedIncident.description,
        parentId: null,
      });

      const updatedRecord = {
        ...incidentTypesStub[0],
        code: updatedIncident.code,
        name: updatedIncident.name,
        severity: updatedIncident.severity,
        description: updatedIncident.description,
        updatedAt: '2024-03-20T12:00:00.000Z',
      };

      incidentTypesStub = incidentTypesStub.map((item) => (item.id === updatedRecord.id ? updatedRecord : item));

      req.reply({
        statusCode: 200,
        body: updatedRecord,
      });
    }).as('updateIncidentType');

    cy.visit('/incident-types');
    cy.wait('@authMe');
    cy.wait('@loadIncidentTypes');
  });

  it('edits an existing incident type and updates the list', () => {
    cy.contains('table tbody tr', initialIncidentTypes[0].code).within(() => {
      cy.contains('button', 'Editar').click();
    });

    cy.contains('section.card', 'Editar')
      .should('be.visible')
      .within(() => {
        cy.get('input[name="edit-code"]').clear().type(updatedIncident.code);
        cy.get('input[name="edit-name"]').clear().type(updatedIncident.name);
        cy.contains('label', 'Severidade *').find('select').select(updatedIncident.severity);
        cy.contains('label', 'Parent').find('select').select('Nenhum (raiz)');
        cy.get('textarea[name="edit-description"]').clear().type(updatedIncident.description);

        cy.contains('button', 'Guardar').click();
      });

    cy.wait('@updateIncidentType');
    cy.wait('@loadIncidentTypes');

    cy.get('table tbody tr').should('have.length', initialIncidentTypes.length);
    cy.contains('table tbody tr', updatedIncident.code).within(() => {
      cy.get('td').eq(0).should('have.text', updatedIncident.code);
      cy.get('td').eq(1).should('have.text', updatedIncident.name);
      cy.get('td').eq(2).should('contain.text', updatedIncident.severity);
      cy.get('td').eq(4).should('contain.text', updatedIncident.description);
    });

    cy.contains('table tbody tr', initialIncidentTypes[0].code).should('not.exist');
    cy.contains('section.card', 'Editar').should('not.exist');
  });
});
