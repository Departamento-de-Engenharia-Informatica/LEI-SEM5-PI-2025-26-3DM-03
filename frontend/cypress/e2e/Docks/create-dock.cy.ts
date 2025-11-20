describe('Docks - Create dock', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin'],
  };

  const initialDocks = [
    {
      id: 1,
      name: 'East Dock A',
      location: 'East Side',
      length: 250,
      depth: 12,
      maxDraft: 10,
    },
    {
      id: 2,
      name: 'North Pier 1',
      location: 'North Side',
      length: 300,
      depth: 15,
      maxDraft: 12,
    },
  ];

  const newDock = {
    id: 3,
    name: 'South Dock B',
    location: 'South Side',
    length: 220,
    depth: 11,
    maxDraft: 9,
  };
  const expectedTotal = initialDocks.length + 1;

  let docksStub: any[];

  beforeEach(() => {
    docksStub = [...initialDocks];

    cy.window().then((win) => {
      win.sessionStorage.clear();
    });

    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: userStub,
    }).as('authMe');

    cy.intercept('GET', '**/api/Docks*', (req) => {
      req.reply({
        statusCode: 200,
        body: docksStub,
      });
    }).as('loadDocks');

    cy.intercept('POST', '**/api/Docks', (req) => {
      expect(req.body).to.deep.equal({
        name: newDock.name,
        location: newDock.location,
        length: newDock.length,
        depth: newDock.depth,
        maxDraft: newDock.maxDraft,
      });

      docksStub = [{ ...newDock }, ...docksStub];

      req.reply({
        statusCode: 201,
        body: { ...newDock },
      });
    }).as('createDock');

    cy.visit('/docks');
    cy.wait('@authMe');
    cy.wait('@loadDocks');
  });

  it('creates a new dock and displays it in the list', () => {
    cy.contains('h1', 'Docks').should('be.visible');

    cy.get('aside .form').within(() => {
      cy.get('input[name="name"]').clear().type(newDock.name);
      cy.get('input[name="location"]').clear().type(newDock.location);
      cy.get('input[name="length"]').clear().type(String(newDock.length));
      cy.get('input[name="depth"]').clear().type(String(newDock.depth));
      cy.get('input[name="maxDraft"]').clear().type(String(newDock.maxDraft));
      cy.contains('button', 'Criar dock').click();
    });

    cy.wait('@createDock');

    cy.get('.dock-card', { timeout: 10_000 }).should('have.length', expectedTotal);
    cy.contains('.dock-card .name', newDock.name, { timeout: 10_000 }).should('be.visible');

    cy.contains('.dock-card', newDock.name).within(() => {
      cy.get('.loc').should('contain.text', newDock.location);
      cy.contains('.stat', 'Comprimento').within(() => {
        cy.get('.number').invoke('text').should('contain', String(newDock.length));
      });
      cy.contains('.stat', 'Profundidade').within(() => {
        cy.get('.number').invoke('text').should('contain', String(newDock.depth));
      });
      cy.contains('.stat', 'Max Draft').within(() => {
        cy.get('.number').invoke('text').should('contain', String(newDock.maxDraft));
      });
    });

    cy.get('aside .form').within(() => {
      cy.get('input[name="name"]').should('have.value', '');
      cy.get('input[name="location"]').should('have.value', '');
      cy.get('input[name="length"]').should('have.value', '0');
      cy.get('input[name="depth"]').should('have.value', '0');
      cy.get('input[name="maxDraft"]').should('have.value', '0');
    });
  });
});
