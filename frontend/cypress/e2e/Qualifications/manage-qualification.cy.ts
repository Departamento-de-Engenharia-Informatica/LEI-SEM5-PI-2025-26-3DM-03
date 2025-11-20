describe('Qualifications - Create and edit', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin'],
  };

  const existingQualifications = [
    { code: 'STS_OP', description: 'STS Crane Operator' },
    { code: 'TRUCK_DRV', description: 'Truck Driver' },
  ];

  const createPayload = { code: 'FORK_OP', description: 'Forklift Operator' };
  const updatedDescription = 'STS Crane Operator - Updated';

  let qualificationsStub: any[];

  beforeEach(() => {
    qualificationsStub = [...existingQualifications];

    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: userStub,
    }).as('authMe');

    cy.intercept('GET', 'https://localhost:7167/api/Qualifications*', (req) => {
      req.reply({
        statusCode: 200,
        body: qualificationsStub,
      });
    }).as('loadQualifications');

    cy.intercept('POST', 'https://localhost:7167/api/Qualifications', (req) => {
      expect(req.body).to.deep.equal(createPayload);

      qualificationsStub = [createPayload, ...qualificationsStub];

      req.reply({
        statusCode: 201,
        body: createPayload,
      });
    }).as('createQualification');

    cy.intercept('PUT', 'https://localhost:7167/api/Qualifications/STS_OP', (req) => {
      expect(req.body).to.deep.equal({
        code: existingQualifications[0].code,
        description: updatedDescription,
      });

      qualificationsStub = qualificationsStub.map((q) =>
        q.code === existingQualifications[0].code ? { ...q, description: updatedDescription } : q
      );

      req.reply({ statusCode: 200, body: {} });
    }).as('updateQualification');

    cy.visit('/qualifications');
    cy.wait('@authMe');
    cy.wait('@loadQualifications');
  });

  it('creates a qualification and edits an existing one', () => {
    cy.contains('button', '+ New Qualification').click();

    cy.get('.qualification-form form').within(() => {
      cy.get('input[name="code"]').clear().type(createPayload.code);
      cy.get('input[name="description"]').clear().type(createPayload.description);
      cy.contains('button', 'Save').click();
    });

    cy.wait('@createQualification');
    cy.wait('@loadQualifications');

    cy.get('.qualification-list .qualification-item').should(($items) => {
      expect($items).to.have.length(qualificationsStub.length);
    });
    cy.contains('.qualification-item', createPayload.code).within(() => {
      cy.contains('.description', createPayload.description).should('be.visible');
    });

    cy.contains('.qualification-item', existingQualifications[0].code).within(() => {
      cy.contains('button', 'Edit').click();
    });

    cy.get('.qualification-form form').within(() => {
      cy.get('input[name="code"]').should('have.value', existingQualifications[0].code).and('be.disabled');
      cy.get('input[name="description"]').clear().type(updatedDescription);
      cy.contains('button', 'Save').click();
    });

    cy.wait('@updateQualification');
    cy.wait('@loadQualifications');

    cy.contains('.qualification-item', existingQualifications[0].code).within(() => {
      cy.contains('.description', updatedDescription).should('be.visible');
    });

    cy.contains('.success-box', 'Qualification updated successfully!').should('be.visible');
  });
});
