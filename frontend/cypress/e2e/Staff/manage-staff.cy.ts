describe('Staff - Create and edit member', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin'],
  };

  const initialStaff = [
    {
      mecanographicNumber: 'EMP-100',
      shortName: 'Ana Silva',
      email: 'ana.silva@example.com',
      phoneNumber: '+35191000000',
      startTime: '07:00:00',
      endTime: '15:00:00',
      status: 'Available',
      active: true,
      qualifications: ['OPS']
    },
  ];

  const newMember = {
    mecanographicNumber: 'EMP-200',
    shortName: 'Bruno Costa',
    email: 'bruno.costa@example.com',
    phoneNumber: '+351911234567',
    startTime: '08:00:00',
    endTime: '16:00:00',
    status: 'Available',
    active: true,
    qualifications: ['OPS', 'SAFE'],
  };

  const updatedMember = {
    shortName: 'Bruno C. Updated',
    email: 'bruno.updated@example.com',
    phoneNumber: '+351933000000',
    startTime: '09:30:00',
    endTime: '17:30:00',
    status: 'On Duty',
    active: false,
    qualifications: ['OPS', 'SAFE', 'NEW'],
  };

  let staffStub: any[];

  beforeEach(() => {
    staffStub = [...initialStaff];

    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: userStub,
    }).as('authMe');

    cy.intercept('GET', '**/api/staff*', (req) => {
      req.reply({
        statusCode: 200,
        body: staffStub,
      });
    }).as('loadStaff');

    cy.intercept('POST', '**/api/staff', (req) => {
      expect(req.body).to.deep.equal({
        mecanographicNumber: newMember.mecanographicNumber,
        shortName: newMember.shortName,
        email: newMember.email,
        phoneNumber: newMember.phoneNumber,
        startTime: newMember.startTime,
        endTime: newMember.endTime,
        qualifications: newMember.qualifications,
      });

      const created = { ...newMember };
      staffStub = [created, ...staffStub];

      req.reply({
        statusCode: 201,
        body: created,
      });
    }).as('createStaff');

    cy.intercept('PUT', `**/api/staff/${encodeURIComponent(newMember.mecanographicNumber)}`, (req) => {
      expect(req.body).to.deep.equal({
        shortName: updatedMember.shortName,
        email: updatedMember.email,
        phoneNumber: updatedMember.phoneNumber,
        startTime: updatedMember.startTime,
        endTime: updatedMember.endTime,
        status: updatedMember.status,
        active: updatedMember.active,
        qualifications: updatedMember.qualifications,
      });

      staffStub = staffStub.map((s) =>
        s.mecanographicNumber === newMember.mecanographicNumber
          ? { ...s, ...updatedMember, mecanographicNumber: newMember.mecanographicNumber }
          : s
      );

      req.reply({ statusCode: 200, body: {} });
    }).as('updateStaff');

    cy.visit('/staff');
    cy.wait('@authMe');
    cy.wait('@loadStaff');
  });

  it('creates a staff member and updates their details', () => {
    cy.contains('h3', 'Registar colaborador').should('be.visible');

    cy.contains('section.card', 'Registar colaborador').within(() => {
      cy.contains('label', 'Nº mecanográfico').find('input').clear().type(newMember.mecanographicNumber);
      cy.contains('label', 'Nome curto').find('input').clear().type(newMember.shortName);
      cy.contains('label', 'Email').find('input').clear().type(newMember.email);
      cy.contains('label', 'Telefone').find('input').clear().type(newMember.phoneNumber);
      cy.contains('label', 'Hora início').find('input').clear().type('08:00');
      cy.contains('label', 'Hora fim').find('input').clear().type('16:00');
      cy.contains('label', 'Qualificações').find('textarea').clear().type(newMember.qualifications.join(', '));
      cy.contains('button', 'Criar').click();
    });

    cy.wait('@createStaff');

    cy.get('table.tbl tbody tr', { timeout: 10_000 }).should(($rows) => {
      expect($rows).to.have.length(initialStaff.length + 1);
    });
    cy.contains('table.tbl tbody tr', newMember.mecanographicNumber, { timeout: 10_000 })
      .scrollIntoView()
      .within(() => {
        cy.contains('strong', newMember.mecanographicNumber).should('be.visible');
        cy.contains('.name', newMember.shortName).scrollIntoView().should('be.visible');
        cy.contains('a', newMember.email).should('be.visible');
        cy.contains('td', newMember.phoneNumber).should('be.visible');
        newMember.qualifications.forEach((qual) => {
          cy.contains('.chip', qual).scrollIntoView().should('be.visible');
        });
        cy.get('.actions button').first().click();
      });

    cy.contains('section.card', 'Editar colaborador').within(() => {
      cy.contains('label', 'Nome curto').find('input').clear().type(updatedMember.shortName);
      cy.contains('label', 'Email').find('input').clear().type(updatedMember.email);
      cy.contains('label', 'Telefone').find('input').clear().type(updatedMember.phoneNumber);
      cy.contains('label', 'Estado').find('input').clear().type(updatedMember.status);
      cy.contains('label', 'Ativo').find('select').select('Inativo');
      cy.contains('label', 'Hora início').find('input').clear().type('09:30');
      cy.contains('label', 'Hora fim').find('input').clear().type('17:30');
      cy.contains('label', 'Qualificações').find('textarea').clear().type(updatedMember.qualifications.join(', '));
      cy.contains('button', 'Guardar').click();
    });

    cy.wait('@updateStaff');

    cy.contains('section.card', 'Editar colaborador').should('not.exist');

    cy.contains('table.tbl tbody tr', newMember.mecanographicNumber)
      .scrollIntoView()
      .within(() => {
        cy.contains('.name', updatedMember.shortName).scrollIntoView().should('be.visible');
        cy.contains('a', updatedMember.email).should('be.visible');
        cy.contains('td', updatedMember.phoneNumber).should('be.visible');
        cy.contains('.badge', 'Inativo').scrollIntoView().should('be.visible');
        cy.contains('.badge-info', updatedMember.status).scrollIntoView().should('be.visible');
        cy.contains('.chip', 'NEW').scrollIntoView().should('be.visible');
      });
  });
});
