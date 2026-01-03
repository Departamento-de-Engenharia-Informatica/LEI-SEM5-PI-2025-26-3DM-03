describe('Complementary Task Categories - Edit', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin'],
  };

  const initialCategories = [
    {
      id: 1,
      code: 'CTC001',
      name: 'Inspection',
      description: 'Routine inspection tasks',
      defaultDurationMinutes: 45,
      createdAt: '2024-03-10T09:00:00.000Z',
    },
    {
      id: 2,
      code: 'CTC005',
      name: 'Maintenance',
      description: 'Preventive maintenance',
      defaultDurationMinutes: null,
      createdAt: '2024-03-11T11:30:00.000Z',
    },
  ];

  const updatedValues = {
    name: 'Inspection & Safety',
    description: 'Combined inspection with safety review',
    defaultDurationMinutes: 60,
  };

  let categoriesStub: typeof initialCategories;

  beforeEach(() => {
    categoriesStub = [...initialCategories];

    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: userStub,
    }).as('authMe');

    cy.intercept('GET', '**/api/oem/complementary-task-categories*', (req) => {
      const query = req.query?.q?.toString().trim().toUpperCase?.();
      if (query) {
        const filtered = categoriesStub.filter((item) => {
          const haystack = `${item.code} ${item.name} ${item.description ?? ''}`.toUpperCase();
          return haystack.includes(query);
        });
        req.reply({ statusCode: 200, body: filtered });
        return;
      }

      req.reply({ statusCode: 200, body: categoriesStub });
    }).as('loadCategories');

    cy.intercept('PATCH', '**/api/oem/complementary-task-categories/*', (req) => {
      const id = Number(req.url.split('/').pop());
      expect(id).to.eq(initialCategories[0].id);
      expect(req.body).to.deep.equal({
        code: initialCategories[0].code,
        name: updatedValues.name,
        description: updatedValues.description,
        defaultDurationMinutes: updatedValues.defaultDurationMinutes,
      });

      const updatedRecord = {
        ...categoriesStub.find((item) => item.id === id)!,
        name: updatedValues.name,
        description: updatedValues.description,
        defaultDurationMinutes: updatedValues.defaultDurationMinutes,
        updatedAt: '2024-03-21T10:00:00.000Z',
      };

      categoriesStub = categoriesStub.map((item) => (item.id === id ? updatedRecord : item));

      req.reply({ statusCode: 200, body: updatedRecord });
    }).as('updateCategory');

    cy.visit('/oem/complementary-task-categories');
    cy.wait('@authMe');
    cy.wait('@loadCategories');
  });

  it('edits an existing complementary task category', () => {
    cy.contains('table.tbl tbody tr', initialCategories[0].code).within(() => {
      cy.get('button.btn-ghost').first().click();
    });

    cy.contains('section.card', 'Editar categoria')
      .should('be.visible')
      .within(() => {
        cy.get('input[formcontrolname="code"]').should('have.attr', 'readonly');
        cy.get('input[formcontrolname="name"]').clear().type(updatedValues.name);
        cy.get('textarea[formcontrolname="description"]').clear().type(updatedValues.description);
        cy.get('input[formcontrolname="defaultDurationMinutes"]').clear().type(String(updatedValues.defaultDurationMinutes));

        cy.contains('button', 'Guardar alterações').click();
      });

    cy.wait('@updateCategory');

    cy.contains('table.tbl tbody tr', initialCategories[0].code).within(() => {
      cy.get('.name').should('have.text', updatedValues.name);
      cy.get('.description').should('contain.text', updatedValues.description);
      cy.contains('td', `${updatedValues.defaultDurationMinutes} min`).should('exist');
    });

    cy.contains('section.card', 'Editar categoria').within(() => {
      cy.get('input[formcontrolname="name"]').should('have.value', updatedValues.name);
      cy.get('textarea[formcontrolname="description"]').should('have.value', updatedValues.description);
      cy.get('input[formcontrolname="defaultDurationMinutes"]').should('have.value', String(updatedValues.defaultDurationMinutes));
    });

    cy.contains('button', 'Cancelar edição').click();

    cy.contains('section.card', 'Criar categoria').within(() => {
      cy.get('input[formcontrolname="code"]').should('have.value', '');
      cy.get('input[formcontrolname="name"]').should('have.value', '');
    });
  });
});
