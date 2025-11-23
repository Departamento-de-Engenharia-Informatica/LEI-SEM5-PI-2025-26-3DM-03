describe('Storage Areas - Create', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin'],
  };

  const initialAreas = [
    {
      id: 1,
      location: 'East Warehouse',
      type: 'Warehouse',
      maxCapacityTEU: 500,
      currentOccupancyTEU: 120,
    },
    {
      id: 2,
      location: 'North Yard',
      type: 'Yard',
      maxCapacityTEU: 1000,
      currentOccupancyTEU: 200,
    },
  ];

  const newArea = {
    id: 3,
    location: 'South Warehouse',
    type: 'Warehouse',
    maxCapacityTEU: 750,
    currentOccupancyTEU: 50,
  };

  let areasStub: any[];
  const expectedTotal = initialAreas.length + 1;

  beforeEach(() => {
    areasStub = [...initialAreas];

    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: userStub,
    }).as('authMe');

    cy.intercept('GET', '**/api/StorageAreas*', (req) => {
      req.reply({
        statusCode: 200,
        body: areasStub,
      });
    }).as('loadAreas');

    cy.intercept('POST', '**/api/StorageAreas', (req) => {
      expect(req.body).to.deep.equal({
        location: newArea.location,
        type: newArea.type,
        maxCapacityTEU: newArea.maxCapacityTEU,
        currentOccupancyTEU: newArea.currentOccupancyTEU,
      });

      areasStub = [{ ...newArea }, ...areasStub];

      req.reply({
        statusCode: 201,
        body: { ...newArea },
      });
    }).as('createArea');

    cy.visit('/storage-areas');
    cy.wait('@authMe');
    cy.wait('@loadAreas');
  });

  it('creates a new storage area and lists it', () => {
    cy.contains('h1', 'Áreas de Armazenamento').should('be.visible');

    cy.get('aside form', { timeout: 10_000 }).first().as('createForm');
    cy.get('@createForm').scrollIntoView({ easing: 'linear', offset: { top: -100, left: 0 } });

    cy.get('@createForm').within(() => {
      cy.get('input[name="location"]').clear().type(newArea.location);
      cy.get('select[name="type"]').select(newArea.type);
      cy.get('input[name="capacity"]').clear().type(String(newArea.maxCapacityTEU));
      cy.get('input[name="occupancy"]').clear().type(String(newArea.currentOccupancyTEU));
      cy.contains('button', 'Criar').click();
    });

    cy.wait('@createArea');

    cy.reload();
    cy.wait('@authMe');
    cy.wait('@loadAreas');

    cy.get('aside form', { timeout: 10_000 }).first().as('createForm');

    cy.contains('.cell-title', newArea.location, { timeout: 10_000 })
      .scrollIntoView({ easing: 'linear', offset: { top: -100, left: 0 } })
      .should('be.visible')
      .closest('tr')
      .within(() => {
        cy.get('td').eq(0).should('contain.text', newArea.location);
        cy.get('td').eq(1).should('contain.text', newArea.type);
        cy.get('td').eq(2).should('contain.text', String(newArea.maxCapacityTEU));
        cy.get('td').eq(3).should('contain.text', String(newArea.currentOccupancyTEU));
      });

    cy.get('@createForm').within(() => {
      cy.get('input[name="location"]').should('have.value', '');
      cy.get('select[name="type"]').should('have.value', 'Yard');
      cy.get('input[name="capacity"]').should('have.value', '0');
      cy.get('input[name="occupancy"]').should('have.value', '0');
    });
  });
});
