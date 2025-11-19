describe('Vessels - Create', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin'],
  };

  const vesselTypesStub = [
    {
      id: 1,
      name: 'Container Ship',
      description: 'Large cargo ship for containers',
      capacity: 5000,
      operationalConstraints: { maxRows: 12, maxBays: 20, maxTiers: 8 },
    },
  ];

  const generateValidImo = () => {
    const digits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10));
    const weights = [7, 6, 5, 4, 3, 2];
    const sum = digits.reduce((acc, digit, idx) => acc + digit * weights[idx], 0);
    const checkDigit = sum % 10;
    return `${digits.join('')}${checkDigit}`;
  };

  const makeId = () => `id-${Date.now()}-${Cypress._.random(1_000_000)}`;

  let vesselsStub: any[];

  beforeEach(() => {
    vesselsStub = [
      {
        id: makeId(),
        name: 'Atlantic Trader',
        imo: '3423540',
        vesselTypeId: 1,
        operator: 'Atlantic Ops',
      },
    ];

    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: userStub,
    }).as('authMe');

    cy.intercept('GET', '**/api/VesselTypes', {
      statusCode: 200,
      body: vesselTypesStub,
    }).as('loadVesselTypes');

    cy.intercept('GET', '**/api/Vessels*', (req) => {
      req.reply({
        statusCode: 200,
        body: vesselsStub,
      });
    }).as('loadVessels');

    cy.visit('/vessels');

    cy.wait('@authMe');
    cy.wait('@loadVesselTypes');
    cy.wait('@loadVessels');

    cy.get('.vessel-list .vessel-item').should('have.length.at.least', 1);
  });

  it('should create a new vessel and display it in the list', () => {
    const vesselName = `Auto Vessel ${Date.now()}`;
    const vesselImo = generateValidImo();

    cy.intercept('POST', '**/api/Vessels', (req) => {
      expect(req.body).to.deep.equal({
        imo: vesselImo,
        name: vesselName,
        operator: 'Test Operator',
        vesselTypeId: 1,
      });

      const created = {
        id: makeId(),
        ...req.body,
      };

      vesselsStub = [created, ...vesselsStub];

      req.reply({
        statusCode: 201,
        body: created,
      });
    }).as('createVessel');

    cy.contains('button', '+ New Vessel').click();

    cy.contains('h3', 'Create Vessel').should('be.visible');

    cy.get('#vesselName').clear().type(vesselName);
    cy.get('#vesselImo').clear().type(vesselImo);
    cy.get('#vesselType').select('Container Ship');
    cy.get('#operator').clear().type('Test Operator');

    cy.contains('button', 'Save').click();

    cy.wait('@createVessel');
    cy.get('.vessel-list', { timeout: 10_000 }).within(() => {
      cy.contains('.vessel-item strong', vesselName, { timeout: 10_000 }).should('be.visible');
    });
  });
});
