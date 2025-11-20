describe('Shipping Agents - Create', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin', 'agent'],
  };

  const taxNumber = 900123456;
  const legalName = 'Atlantic Shipping SA';
  const alternativeName = 'Atlantic Logistics';
  const address = {
    street: 'Rua do Porto 15',
    city: 'Lisboa',
    postalCode: '1000-001',
    country: 'Portugal',
  };
  const representative = {
    name: 'Joana Costa',
    citizenID: 'ID123456',
    nationality: 'PT',
    email: 'joana.costa@example.com',
    phoneNumber: '+351933000000',
  };

  beforeEach(() => {
    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: userStub,
    }).as('authMe');

    cy.intercept('GET', '**/api/ShippingAgents/*', (req) => {
      if (req.url.endsWith(`/${taxNumber}`)) {
        req.reply({ statusCode: 404, body: {} });
      } else {
        req.reply({ statusCode: 404, body: {} });
      }
    }).as('getAgentNotFound');

    cy.intercept('POST', '**/api/ShippingAgents', (req) => {
      expect(req.body).to.deep.equal({
        taxNumber,
        legalName,
        alternativeName,
        type: 'Owner',
        address,
        representatives: [
          {
            id: 0,
            name: representative.name,
            citizenID: representative.citizenID,
            nationality: representative.nationality,
            email: representative.email,
            phoneNumber: representative.phoneNumber,
            isActive: true,
          },
        ],
      });

      const created = {
        taxNumber,
        legalName,
        alternativeName,
        type: 'Owner',
        address,
        representatives: [
          {
            id: 101,
            name: representative.name,
            citizenID: representative.citizenID,
            nationality: representative.nationality,
            email: representative.email,
            phoneNumber: representative.phoneNumber,
            isActive: true,
          },
        ],
      };

      req.reply({ statusCode: 201, body: created });
    }).as('createAgent');

    cy.visit('/shipping-agents');
    cy.wait('@authMe');
  });

  it('shows not found message then creates a new agent', () => {
    cy.contains('h2', 'Agentes de Navegação').should('be.visible');

    cy.get('input[placeholder="ex: 123456789"]').clear().type(String(taxNumber));
    cy.contains('button', 'Pesquisar').click();

    cy.wait('@getAgentNotFound');
    cy.contains('.alert-error', 'Nenhuma organização com esse número de identificação fiscal.').should('be.visible');

    cy.contains('section.card', 'Novo Agente de Navegação').within(() => {
      cy.get('input[name="taxNumber"]').clear().type(String(taxNumber));
      cy.get('input[name="legalName"]').clear().type(legalName);
      cy.get('input[name="alternativeName"]').clear().type(alternativeName);
      cy.get('select[name="type"]').select('Owner');
      cy.get('input[name="street"]').clear().type(address.street);
      cy.get('input[name="city"]').clear().type(address.city);
      cy.get('input[name="postalCode"]').clear().type(address.postalCode);
      cy.get('input[name="country"]').clear().type(address.country);

      cy.get('input[name="repName"]').clear().type(representative.name);
      cy.get('input[name="repCitizen"]').clear().type(representative.citizenID);
      cy.get('input[name="repNationality"]').clear().type(representative.nationality);
      cy.get('input[name="repEmail"]').clear().type(representative.email);
      cy.get('input[name="repPhone"]').clear().type(representative.phoneNumber);

      cy.contains('button', 'Registar').click();
    });

    cy.wait('@createAgent');

    cy.contains('section.card', legalName).within(() => {
      cy.contains('h3', legalName).should('be.visible');
      cy.contains('p.muted', `#${taxNumber}`).should('be.visible');
      cy.contains('.badge', 'Owner').should('be.visible');
      cy.contains('.details dd', `${address.street}, ${address.postalCode} ${address.city}, ${address.country}`).should('be.visible');
      cy.contains('li', representative.name)
        .should('contain', representative.email)
        .and('contain', representative.phoneNumber);
    });

    cy.contains('section.card', 'Novo Agente de Navegação').within(() => {
      cy.get('input[name="legalName"]').should('have.value', '');
      cy.get('input[name="alternativeName"]').should('have.value', '');
      cy.get('input[name="repName"]').should('have.value', '');
    });
  });
});
