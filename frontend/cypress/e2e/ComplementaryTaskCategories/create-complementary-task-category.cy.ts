describe('Complementary Task Categories - Create', () => {
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

  const newCategory = {
    code: 'CTC010',
    name: 'Safety Briefing',
    description: 'Briefing for safety procedures',
    defaultDurationMinutes: 30,
  };

  const expectedTotal = initialCategories.length + 1;
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

    cy.intercept('POST', '**/api/oem/complementary-task-categories', (req) => {
      expect(req.body).to.deep.equal({
        code: newCategory.code,
        name: newCategory.name,
        description: newCategory.description,
        defaultDurationMinutes: newCategory.defaultDurationMinutes,
      });

      const created = {
        id: 99,
        code: newCategory.code,
        name: newCategory.name,
        description: newCategory.description,
        defaultDurationMinutes: newCategory.defaultDurationMinutes,
        createdAt: '2024-03-20T12:00:00.000Z',
      };

      categoriesStub = [...categoriesStub, created].sort((a, b) => a.code.localeCompare(b.code));

      req.reply({ statusCode: 201, body: created });
    }).as('createCategory');

    cy.visit('/oem/complementary-task-categories');
    cy.wait('@authMe');
    cy.wait('@loadCategories');
  });

  it('creates a complementary task category and shows it in the list', () => {
    cy.contains('section.card', 'Criar categoria').within(() => {
      cy.get('input[formcontrolname="code"]').clear().type(newCategory.code);
      cy.get('input[formcontrolname="name"]').clear().type(newCategory.name);
      cy.get('textarea[formcontrolname="description"]').clear().type(newCategory.description);
      cy.get('input[formcontrolname="defaultDurationMinutes"]').clear().type(String(newCategory.defaultDurationMinutes));

      cy.contains('button', 'Criar categoria').click();
    });

    cy.wait('@createCategory');

    cy.get('table.tbl tbody tr').should('have.length', expectedTotal);
    cy.contains('table.tbl tbody tr', newCategory.code).within(() => {
      cy.get('.code-col').should('have.text', newCategory.code);
      cy.get('.name').should('have.text', newCategory.name);
      cy.get('.description').should('contain.text', newCategory.description);
      cy.contains('td', `${newCategory.defaultDurationMinutes} min`).should('exist');
    });

    cy.contains('section.card', 'Criar categoria').within(() => {
      cy.get('input[formcontrolname="code"]').should('have.value', '');
      cy.get('input[formcontrolname="name"]').should('have.value', '');
      cy.get('textarea[formcontrolname="description"]').should('have.value', '');
      cy.get('input[formcontrolname="defaultDurationMinutes"]').should('have.value', '');
    });
  });
});
