describe('Complementary Tasks - Create', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin'],
  };

  const categoriesStub = [
    {
      id: 10,
      code: 'CTC010',
      name: 'Safety Ops',
      description: 'Safety related operations',
      defaultDurationMinutes: 30,
      createdAt: '2024-03-10T09:00:00.000Z',
    },
    {
      id: 11,
      code: 'CTC011',
      name: 'Maintenance',
      description: 'Preventive maintenance tasks',
      defaultDurationMinutes: null,
      createdAt: '2024-03-11T11:30:00.000Z',
    },
  ];

  const vvesStub = [
    {
      id: 500,
      vesselVisitNotificationId: 100,
      vesselVisitId: 200,
      vesselName: 'Vessel Aurora',
      status: 'IN_PROGRESS',
    },
    {
      id: 501,
      vesselVisitNotificationId: 101,
      vesselVisitId: 201,
      vesselName: 'Vessel Nemo',
      status: 'READY',
    },
  ];

  const startLocal = '2024-03-20T10:30';
  const expectedStartIso = new Date(startLocal).toISOString();

  const initialTasks = [
    {
      id: 900,
      identifier: 'CT-0001',
      categoryId: 11,
      vveId: 500,
      team: 'Maintenance Crew',
      mode: 'PARALLEL',
      startTime: '2024-03-18T08:00:00.000Z',
      endTime: null,
      durationMinutes: null,
      status: 'ONGOING',
      isImpactingNow: false,
      createdBy: 'admin',
      createdAt: '2024-03-18T08:05:00.000Z',
      updatedAt: '2024-03-18T08:05:00.000Z',
    },
  ];

  const newTaskForm = {
    categoryId: categoriesStub[0].id,
    vveId: vvesStub[1].id,
    team: 'Safety Team',
    mode: 'SUSPENDS',
  };

  let tasksStub: typeof initialTasks;
  const expectedTotal = initialTasks.length + 1;

  beforeEach(() => {
    tasksStub = [...initialTasks];

    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: userStub,
    }).as('authMe');

    cy.intercept('GET', '**/api/oem/complementary-task-categories*', {
      statusCode: 200,
      body: categoriesStub,
    }).as('loadCategories');

    cy.intercept('GET', '**/api/oem/vessel-visit-executions*', {
      statusCode: 200,
      body: vvesStub,
    }).as('loadVves');

    cy.intercept('GET', '**/api/oem/complementary-tasks*', {
      statusCode: 200,
      body: tasksStub,
    }).as('loadTasks');

    cy.intercept('POST', '**/api/oem/complementary-tasks', (req) => {
      expect(req.body).to.deep.equal({
        categoryId: newTaskForm.categoryId,
        vveId: newTaskForm.vveId,
        team: newTaskForm.team,
        mode: newTaskForm.mode,
        startTime: expectedStartIso,
      });

      const createdTask = {
        id: 901,
        identifier: 'CT-0002',
        categoryId: newTaskForm.categoryId,
        vveId: newTaskForm.vveId,
        team: newTaskForm.team,
        mode: newTaskForm.mode,
        startTime: expectedStartIso,
        endTime: null,
        durationMinutes: null,
        status: 'ONGOING',
        isImpactingNow: true,
        createdBy: 'admin',
        createdAt: '2024-03-20T09:00:00.000Z',
        updatedAt: '2024-03-20T09:00:00.000Z',
      };

      tasksStub = [createdTask, ...tasksStub];

      req.reply({
        statusCode: 201,
        body: createdTask,
      });
    }).as('createTask');

    cy.visit('/oem/complementary-tasks');
    cy.wait('@authMe');
    cy.wait('@loadCategories');
    cy.wait('@loadVves');
    cy.wait('@loadTasks');
  });

  it('creates a complementary task and shows it in the list', () => {
    cy.contains('section.card', 'Criar tarefa complementar')
      .should('be.visible')
      .within(() => {
        cy.contains('label', 'Categoria').find('select').select('CTC010 - Safety Ops');
        cy.contains('label', 'VVE').find('select').select('#501 Vessel Nemo');
        cy.contains('label', 'Equipa / Servico').find('input').clear().type(newTaskForm.team);
        cy.contains('label', 'Mode').find('select').select(newTaskForm.mode);
        cy.contains('label', 'Start time').find('input[type="datetime-local"]').clear().type(startLocal);

        cy.contains('button', 'Criar tarefa').click();
      });

    cy.wait('@createTask');

    cy.get('table.tbl tbody tr').should('have.length', expectedTotal);

    cy.contains('table.tbl tbody tr', 'CT-0002').within(() => {
      cy.get('td').eq(1).should('contain.text', 'CTC010 - Safety Ops');
      cy.get('td').eq(2).should('contain.text', '#501 Vessel Nemo');
      cy.get('td').eq(3).should('have.text', newTaskForm.team);
      cy.get('td').eq(4).should('contain.text', 'Suspends ops');
      cy.get('td').eq(5).should('contain.text', 'Ongoing');
    });

    cy.contains('section.card', 'Criar tarefa complementar').within(() => {
      cy.contains('label', 'Categoria').find('select').should('have.prop', 'selectedIndex', 0);
      cy.contains('label', 'VVE').find('select').should('have.prop', 'selectedIndex', 0);
      cy.contains('label', 'Equipa / Servico').find('input').should('have.value', '');
      cy.contains('label', 'Mode').find('select').should('have.value', 'PARALLEL');
      cy.contains('label', 'Start time').find('input[type="datetime-local"]').should('not.have.value', '');
      cy.contains('label', 'Marcar como concluida').find('input[type="checkbox"]').should('not.be.checked');
    });
  });
});
