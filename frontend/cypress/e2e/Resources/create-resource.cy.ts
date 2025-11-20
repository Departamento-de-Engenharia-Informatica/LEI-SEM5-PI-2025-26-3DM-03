describe('Resources - Create resource', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin'],
  };

  const initialResources = [
    {
      code: 'CRANE_01',
      description: 'Main crane',
      type: 'Crane',
      status: 'Active',
      operationalCapacity: 2,
      assignedArea: 'A1',
      setupTimeMinutes: 15,
      requiredQualifications: ['Q-OPS'],
    },
    {
      code: 'TRUCK_01',
      description: 'Yard truck',
      type: 'Truck',
      status: 'Active',
      operationalCapacity: 4,
      assignedArea: 'B2',
      setupTimeMinutes: 10,
      requiredQualifications: ['Q-DRV'],
    },
  ];

  const qualificationsStub = [
    { code: 'Q-OPS', description: 'Operations Permit' },
    { code: 'Q-DRV', description: 'Driver License' },
  ];

  const newResource = {
    code: 'FORK_01',
    description: 'Forklift unit',
    type: 'Truck',
    operationalCapacity: 3,
    status: 'Active',
    assignedArea: 'C3',
    setupTimeMinutes: 20,
    requiredQualifications: ['Q-OPS'],
  };

  let resourcesStub: any[];
  const expectedTotal = initialResources.length + 1;

  beforeEach(() => {
    resourcesStub = [...initialResources];

    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: userStub,
    }).as('authMe');

    cy.intercept('GET', '**/api/Resources*', (req) => {
      req.reply({
        statusCode: 200,
        body: resourcesStub,
      });
    }).as('loadResources');

    cy.intercept('GET', 'https://localhost:7167/api/Qualifications*', {
      statusCode: 200,
      body: qualificationsStub,
    }).as('loadQualifications');

    cy.intercept('POST', '**/api/Resources', (req) => {
      expect(req.body).to.deep.equal({
        code: newResource.code,
        description: newResource.description,
        type: newResource.type,
        operationalCapacity: newResource.operationalCapacity,
        status: newResource.status,
        assignedArea: newResource.assignedArea,
        setupTimeMinutes: newResource.setupTimeMinutes,
        requiredQualifications: newResource.requiredQualifications,
      });

      const created = { ...newResource };
      resourcesStub = [created, ...resourcesStub];

      req.reply({
        statusCode: 201,
        body: created,
      });
    }).as('createResource');

    cy.visit('/resources');
    cy.wait('@authMe');
    cy.wait('@loadResources');
    cy.wait('@loadQualifications');
  });

  it('creates a new resource and shows it in the table', () => {
    cy.contains('button', 'Create resource').click();

    cy.get('section.card form').within(() => {
      cy.get('input[name="code"]').clear().type(newResource.code);
      cy.get('input[name="description"]').clear().type(newResource.description);
      cy.get('select[name="type"]').select(newResource.type);
      cy.get('input[name="setupTimeMinutes"]').clear().type(String(newResource.setupTimeMinutes));
      cy.get('input[name="operationalCapacity"]').clear().type(String(newResource.operationalCapacity));
      cy.get('input[name="assignedArea"]').clear().type(newResource.assignedArea);

      cy.get('select[name="selectedQualification"]').select(`${newResource.requiredQualifications[0]} - ${qualificationsStub[0].description}`);

      cy.contains('button', 'Save').click();
    });

    cy.wait('@createResource');
    cy.wait('@loadResources');

    cy.get('table.tbl tbody tr', { timeout: 10_000 }).should('have.length', expectedTotal);
    cy.contains('table.tbl tbody tr', newResource.code).within(() => {
      cy.get('.col-code').should('have.text', newResource.code);
      cy.get('.col-type').should('have.text', newResource.type);
      cy.get('.col-status .badge').should('contain.text', newResource.status);
    });

    cy.get('section.card form').should('not.exist');
  });
});
