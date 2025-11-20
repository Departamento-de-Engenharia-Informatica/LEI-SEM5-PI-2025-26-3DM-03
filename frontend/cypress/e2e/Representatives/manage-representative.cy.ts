describe('Representatives - Load, create and edit', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin'],
  };

  const taxNumber = 500123456;

  const initialRepresentatives: any[] = [];

  const newRepresentative = {
    name: 'Carlos Matos',
    citizenID: 'ID998877',
    nationality: 'PT',
    email: 'carlos.matos@example.com',
    phoneNumber: '+351934000000',
    isActive: true,
  };

  const updatedRepresentative = {
    name: 'Carlos Matos Updated',
    citizenID: 'ID998877-UPD',
    nationality: 'ES',
    email: 'carlos.updated@example.com',
    phoneNumber: '+34 900 000 000',
    isActive: false,
  };

  let representativesStub: any[];

  beforeEach(() => {
    representativesStub = [...initialRepresentatives];

    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: userStub,
    }).as('authMe');

    cy.intercept('GET', `**/api/ShippingAgents/${taxNumber}/Representatives`, (req) => {
      req.reply({
        statusCode: 200,
        body: representativesStub,
      });
    }).as('loadRepresentatives');

    cy.intercept('POST', `**/api/ShippingAgents/${taxNumber}/Representatives`, (req) => {
      expect(req.body).to.deep.equal({
        name: newRepresentative.name,
        citizenID: newRepresentative.citizenID,
        nationality: newRepresentative.nationality,
        email: newRepresentative.email,
        phoneNumber: newRepresentative.phoneNumber,
      });

      const created = { id: 101, ...newRepresentative };
      representativesStub = [created, ...representativesStub];

      req.reply({
        statusCode: 201,
        body: created,
      });
    }).as('createRepresentative');

    cy.intercept('PUT', `**/api/ShippingAgents/${taxNumber}/Representatives/101`, (req) => {
      expect(req.body).to.deep.equal({
        name: updatedRepresentative.name,
        citizenID: updatedRepresentative.citizenID,
        nationality: updatedRepresentative.nationality,
        email: updatedRepresentative.email,
        phoneNumber: updatedRepresentative.phoneNumber,
        isActive: updatedRepresentative.isActive,
      });

      const updated = { id: 101, taxNumber, ...updatedRepresentative };
      representativesStub = representativesStub.map((rep) =>
        rep.id === 101 ? updated : rep
      );

      req.reply({
        statusCode: 200,
        body: updated,
      });
    }).as('updateRepresentative');

    cy.visit('/representatives');
    cy.wait('@authMe');
  });

  it('loads, creates and edits a representative for an agent', () => {
    cy.contains('h2', 'Representantes').should('be.visible');

    cy.get('.header-actions .agent-input input[placeholder="ex: 500123456"]').clear().type(String(taxNumber));
    cy.contains('button', 'Carregar').click();

    cy.wait('@loadRepresentatives');
    cy.contains('.alert', 'Sem representantes para este agente.').should('be.visible');

    cy.contains('section.card', 'Novo representante').within(() => {
      cy.contains('label', 'NIF do Agente').find('input').should('have.value', String(taxNumber));
      cy.contains('label', 'Nome').find('input').clear().type(newRepresentative.name);
      cy.contains('label', 'ID Cidadão').find('input').clear().type(newRepresentative.citizenID);
      cy.contains('label', 'Nacionalidade').find('input').clear().type(newRepresentative.nationality);
      cy.contains('label', 'Email').find('input').clear().type(newRepresentative.email);
      cy.contains('label', 'Telefone').find('input').clear().type(newRepresentative.phoneNumber);
      cy.contains('button', 'Criar').should('not.be.disabled').click();
    });

    cy.wait('@createRepresentative');

    cy.get('table.tbl tbody tr', { timeout: 10_000 }).should('have.length', 1);
    cy.contains('table.tbl tbody tr', newRepresentative.name, { timeout: 10_000 })
      .scrollIntoView()
      .within(() => {
        cy.contains('td', newRepresentative.name).should('be.visible');
        cy.contains('td', newRepresentative.citizenID).should('be.visible');
        cy.contains('td', newRepresentative.nationality).should('be.visible');
        cy.contains('td', newRepresentative.email).should('be.visible');
        cy.contains('td', newRepresentative.phoneNumber).should('be.visible');
        cy.contains('.badge', 'Ativo').scrollIntoView().should('be.visible');
        cy.get('button.btn-ghost').first().click();
      });

    cy.contains('section.card', 'Editar representante').within(() => {
      cy.contains('label', 'Nome').find('input').clear().type(updatedRepresentative.name);
      cy.contains('label', 'ID Cidadão').find('input').clear().type(updatedRepresentative.citizenID);
      cy.contains('label', 'Nacionalidade').find('input').clear().type(updatedRepresentative.nationality);
      cy.contains('label', 'Email').find('input').clear().type(updatedRepresentative.email);
      cy.contains('label', 'Telefone').find('input').clear().type(updatedRepresentative.phoneNumber);
      cy.contains('label', 'Estado').find('select').select('Inativo');
      cy.contains('button', 'Guardar').click();
    });

    cy.wait('@updateRepresentative');

    cy.contains('section.card', 'Editar representante').should('not.exist');

    cy.contains('table.tbl tbody tr', updatedRepresentative.name)
      .scrollIntoView()
      .within(() => {
        cy.contains('td', updatedRepresentative.citizenID).should('be.visible');
        cy.contains('td', updatedRepresentative.nationality).should('be.visible');
        cy.contains('td', updatedRepresentative.email).should('be.visible');
        cy.contains('td', updatedRepresentative.phoneNumber).should('be.visible');
        cy.contains('.badge', 'Inativo').scrollIntoView().should('be.visible');
      });

    cy.contains('section.card', 'Novo representante').within(() => {
      cy.contains('label', 'Nome').find('input').should('have.value', '');
      cy.contains('label', 'Email').find('input').should('have.value', '');
    });
  });
});
