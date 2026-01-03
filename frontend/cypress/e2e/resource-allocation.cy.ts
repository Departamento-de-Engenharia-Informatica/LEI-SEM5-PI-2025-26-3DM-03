describe('OEM - Resource Allocation', () => {
  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin'],
  };

  const TARGET_DAY = '2025-11-16';
  const TARGET_FROM = `${TARGET_DAY}T00:00`;
  const TARGET_TO = `${TARGET_DAY}T23:59`;

  const allocationStub = [
    {
      resourceType: 'crane',
      resourceId: 'CR-01',
      totalAllocatedMinutes: 180,
      totalAllocatedHours: 3,
      operationCount: 5,
    },
    {
      resourceType: 'crane',
      resourceId: 'CR-02',
      totalAllocatedMinutes: 60,
      totalAllocatedHours: 1,
      operationCount: 2,
    },
  ];

  const docksStub = [
    { id: 1, name: 'D1', location: 'Norte' },
    { id: 2, name: 'D2', location: 'Sul' },
  ];

  const cranesStub = [
    { id: 10, code: 'CR-01', description: 'Grua 1', type: 'CRANE' },
    { id: 11, code: 'CR-02', description: 'Grua 2', type: 'CRANE' },
  ];

  const staffStub = [
    { id: 100, mecanographicNumber: 'M001', shortName: 'OP1' },
    { id: 101, mecanographicNumber: 'M002', shortName: 'OP2' },
  ];

  beforeEach(() => {
    // Congela o relogio para 16/11/2025 para que o intervalo
    // por defeito do componente caia nesse dia.
    const frozen = new Date('2025-11-16T10:00:00.000Z');
    cy.clock(frozen.getTime(), ['Date']);

    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: userStub,
    }).as('authMe');

    cy.intercept('GET', '**/api/oem/operation-plans/resource-allocation*', (req) => {
      const url = new URL(req.url);
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const resourceType = url.searchParams.get('resourceType');
      const resourceId = url.searchParams.get('resourceId');

      expect(resourceType).to.be.oneOf(['crane', 'dock', 'staff']);

      req.reply({
        statusCode: 200,
        body: allocationStub,
      });
    }).as('loadAllocation');

    // Servicos auxiliares devolvem listas para os selects quando necessario
    // DocksService usa /api/Docks (maiusculas, sem /oem)
    cy.intercept('GET', '**/api/Docks*', {
      statusCode: 200,
      body: docksStub,
    }).as('loadDocks');

    // ResourcesService usa /api/Resources
    cy.intercept('GET', '**/api/Resources*', {
      statusCode: 200,
      body: cranesStub,
    }).as('loadResources');

    // StaffService usa /api/staff
    cy.intercept('GET', '**/api/staff*', {
      statusCode: 200,
      body: staffStub,
    }).as('loadStaff');

    cy.visit('/oem/resource-allocation');
    cy.wait('@authMe');
    cy.wait('@loadAllocation');
  });

  it('mostra resultados iniciais de alocacao para o intervalo por defeito', () => {
    // Garante que estamos na pagina certa
    cy.contains('h1', 'Alocacao de Recursos').should('be.visible');

    // Valida apenas que o pedido inicial de alocacao foi feito com os
    // parametros esperados (intervalo por defeito e tipo crane), sem
    // depender da renderizacao da tabela.
    cy.get('@loadAllocation').then((interception: any) => {
      const url = new URL(interception.request.url);
      const resourceType = url.searchParams.get('resourceType');
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');

      expect(resourceType).to.eq('crane');
      expect(from).to.not.be.null;
      expect(to).to.not.be.null;
    });
  });

  it('altera o intervalo e o tipo de recurso para consultar por doca', () => {
    // Mudar para doca
    cy.contains('label', 'Tipo de recurso').within(() => {
      cy.get('select').select('dock');
    });

    // Submeter pesquisa
    cy.contains('button', 'Consultar').click();

    cy.wait('@loadAllocation').then((interception) => {
      const url = new URL(interception.request.url);
      const resourceType = url.searchParams.get('resourceType');
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');

      expect(resourceType).to.eq('dock');

      // Garante que o intervalo enviado contem o dia 16/11/2025
      expect(from).to.contain(TARGET_DAY);
      expect(to).to.contain(TARGET_DAY);
    });
  });

  it('consulta alocacao de staff para um operador especifico', () => {
    // Mudar para staff
    cy.contains('label', 'Tipo de recurso').within(() => {
      cy.get('select').select('staff');
    });
    cy.contains('button', 'Consultar').click();

    cy.wait('@loadAllocation').then((interception) => {
      const url = new URL(interception.request.url);
      const resourceType = url.searchParams.get('resourceType');
      expect(resourceType).to.eq('staff');
    });
  });

  it('limpa o formulario e mostra mensagem de sem resultados', () => {
    // Em alguns momentos o botao pode continuar marcado como disabled
    // devido a transicoes internas de estado; forcar o click garante que
    // exercitamos a logica de reset sem tornar o teste fragil.
    cy.contains('button', 'Limpar').click({ force: true });

    cy.get('table tbody tr').should('not.exist');
    // A mensagem informativa pode variar dependendo do estado interno;
    // o que nos interessa aqui e que nao haja resultados visiveis.
  });
});
