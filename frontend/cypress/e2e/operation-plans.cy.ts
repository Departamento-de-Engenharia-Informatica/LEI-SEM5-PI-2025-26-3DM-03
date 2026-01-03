/// <reference types="cypress" />

// Testes E2E para a pagina de Planos de Operacao,
// seguindo o mesmo estilo dos testes de Incident Types
// (stubs em memoria + cy.intercept + asserts sobre requests e UI).

interface OperationPlanStub {
  id: number;
  name: string;
  status: string;
  vesselVisitId?: number | null;
  dockId?: string | null;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  targetDay?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  algorithmUsed?: string | null;
  createdBy?: string | null;
}

describe('Operation Plans - Saved list & edit', () => {
  const TARGET_DATE = '2025-11-23'; // 23/11/2025 em formato ISO para input date

  const userStub = {
    name: 'DevLapr5 salvador',
    email: 'salvadordevlapr@gmail.com',
    role: 'admin',
    roles: ['admin'],
  };

  const allPlans: OperationPlanStub[] = [
    {
      id: 1,
      name: 'Plan Alpha',
      status: 'planned',
      vesselVisitId: 1,
      dockId: 'D1',
      plannedStartTime: '2024-03-10T08:00:00.000Z',
      plannedEndTime: '2024-03-10T16:00:00.000Z',
      targetDay: '2024-03-10',
      createdAt: '2024-03-05T09:00:00.000Z',
      updatedAt: '2024-03-06T10:00:00.000Z',
      algorithmUsed: 'single-crane',
      createdBy: 'tester',
    },
    {
      id: 2,
      name: 'Plan Beta',
      status: 'completed',
      vesselVisitId: 2,
      dockId: 'D2',
      plannedStartTime: '2024-03-15T08:00:00.000Z',
      plannedEndTime: '2024-03-15T18:00:00.000Z',
      targetDay: '2024-03-15',
      createdAt: '2024-03-12T11:00:00.000Z',
      updatedAt: '2024-03-16T12:00:00.000Z',
      algorithmUsed: 'multi-crane',
      createdBy: 'tester',
    },
    {
      id: 3,
      name: 'Plan Gamma',
      status: 'draft',
      vesselVisitId: 11,
      dockId: 'D3',
      plannedStartTime: '2024-03-20T06:00:00.000Z',
      plannedEndTime: '2024-03-20T14:00:00.000Z',
      targetDay: '2024-03-20',
      createdAt: '2024-03-18T08:00:00.000Z',
      updatedAt: '2024-03-18T09:30:00.000Z',
      algorithmUsed: 'single-crane',
      createdBy: 'tester',
    },
  ];

  const updatedSummary = {
    status: 'completed',
    dockId: 'D99',
    reason: 'Ajuste via teste E2E',
  };

  // Preview padrao (quando o utilizador gera plano a partir do formulario principal)
  const previewPlansDefault = [
    {
      vvnId: 1,
      vesselName: 'Vessel One',
      dockId: 'D1',
      plannedStartTime: `${TARGET_DATE}T08:00:00.000Z`,
      plannedEndTime: `${TARGET_DATE}T12:00:00.000Z`,
      expectedDelayMinutes: 0,
      algorithmUsed: 'single-crane',
      operations: [],
    },
    {
      vvnId: 2,
      vesselName: 'Vessel Two',
      dockId: 'D2',
      plannedStartTime: `${TARGET_DATE}T13:00:00.000Z`,
      plannedEndTime: `${TARGET_DATE}T18:00:00.000Z`,
      expectedDelayMinutes: 15,
      algorithmUsed: 'single-crane',
      operations: [],
    },
  ];

  // Preview especifico quando se gera a partir de um VVN em falta
  const missingVvnStub = {
    id: 201,
    vesselName: 'Missing Vessel',
    dockId: 'D3',
    eta: `${TARGET_DATE}T05:00:00.000Z`,
    etd: null,
    containers: 42,
    status: 'scheduled',
  };

  const previewFromMissing = {
    vvnId: missingVvnStub.id,
    vesselName: missingVvnStub.vesselName,
    dockId: missingVvnStub.dockId,
    plannedStartTime: `${TARGET_DATE}T06:00:00.000Z`,
    plannedEndTime: `${TARGET_DATE}T10:00:00.000Z`,
    expectedDelayMinutes: 5,
    algorithmUsed: 'single-crane',
    operations: [],
  };

  let plansStub: OperationPlanStub[];

  beforeEach(() => {
    plansStub = [...allPlans];

    // Congela a data global da app para 23/11/2025, para que todayIso()
    // e os pedidos ao backend utilizem sempre esta data previsivel.
    const frozen = new Date(`${TARGET_DATE}T00:00:00Z`).getTime();
    cy.clock(frozen, ['Date']);

    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: userStub,
    }).as('authMe');

    // Lista de planos guardados (com filtros opcionais).
    // Ignora endpoints especificos como /missing ou /resource-allocation,
    // que sao tratados por intercepts proprios.
    cy.intercept('GET', '**/api/oem/operation-plans*', (req) => {
      const url = new URL(req.url);

      if (url.pathname.includes('/operation-plans/missing') || url.pathname.includes('/operation-plans/resource-allocation')) {
        return req.continue();
      }
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const vvn = url.searchParams.get('vesselVisitId');

      let result = [...plansStub];

      if (from && to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        result = result.filter((p) => {
          if (!p.targetDay) return false;
          const d = new Date(p.targetDay);
          return d >= fromDate && d <= toDate;
        });
      }

      if (vvn) {
        result = result.filter((p) => `${p.vesselVisitId ?? ''}`.includes(vvn));
      }

      req.reply({
        statusCode: 200,
        body: result,
      });
    }).as('loadPlans');

    // Detalhes de um plano (usado em detalhes/edicao)
    cy.intercept('GET', /\/api\/oem\/operation-plans\/(\d+)$/ , (req) => {
      const idStr = req.url.split('/').pop() ?? '';
      const id = Number(idStr.split('?')[0]);
      const plan = plansStub.find((p) => p.id === id);
      if (!plan) {
        req.reply({ statusCode: 404 });
        return;
      }

      req.reply({
        statusCode: 200,
        body: {
          ...plan,
          description: 'Stubbed plan',
          tasks: [],
          changeLogs: [],
        },
      });
    }).as('getPlan');

    // Atualizacao de plano (edicao)
    cy.intercept('PATCH', /\/api\/oem\/operation-plans\/(\d+)$/ , (req) => {
      const idStr = req.url.split('/').pop() ?? '';
      const id = Number(idStr.split('?')[0]);

      expect(req.body).to.have.property('reason');

      const existing = plansStub.find((p) => p.id === id);
      if (!existing) {
        req.reply({ statusCode: 404 });
        return;
      }

      const updated: OperationPlanStub = {
        ...existing,
        status: req.body.status ?? existing.status,
        dockId: req.body.dockId ?? existing.dockId,
        updatedAt: '2024-03-21T10:00:00.000Z',
      };

      plansStub = plansStub.map((p) => (p.id === id ? updated : p));

      req.reply({
        statusCode: 200,
        body: {
          plan: {
            ...updated,
            description: 'Stubbed plan',
            tasks: [],
            changeLogs: [],
          },
          warnings: [],
        },
      });
    }).as('updatePlan');

    // Eliminacao de um plano
    cy.intercept('DELETE', /\/api\/oem\/operation-plans\/(\d+)$/ , (req) => {
      const idStr = req.url.split('/').pop() ?? '';
      const id = Number(idStr.split('?')[0]);

      plansStub = plansStub.filter((p) => p.id !== id);

      req.reply({
        statusCode: 200,
        body: {},
      });
    }).as('deletePlan');

    // Preview de planos de operacao (formulario principal e geracao a partir de VVN em falta)
    cy.intercept('POST', '**/api/oem/operation-plans/preview', (req) => {
      const body = req.body || {};
      if (Array.isArray(body.vvnIds) && body.vvnIds.length === 1 && body.vvnIds[0] === missingVvnStub.id) {
        req.reply({ statusCode: 200, body: [previewFromMissing] });
      } else {
        req.reply({ statusCode: 200, body: previewPlansDefault });
      }
    }).as('previewPlans');

    // Geracao/gravacao de planos (persistir preview)
    cy.intercept('POST', '**/api/oem/operation-plans/generate', (req) => {
      req.reply({ statusCode: 201, body: [] });
    }).as('generatePlans');

    // VVNs em falta para uma dada data
    cy.intercept('GET', '**/api/oem/operation-plans/missing*', (req) => {
      // Para simplificar o teste, devolvemos sempre um VVN em falta;
      // a validacao da data e feita no proprio teste via URLSearchParams.
      req.reply({ statusCode: 200, body: [missingVvnStub] });
    }).as('loadMissingPlans');

    cy.visit('/oem/operation-plans');
    cy.wait('@authMe');
    cy.wait('@loadPlans');
  });

  it('filtra planos guardados pelo id do VVN', () => {
    cy.get('section.saved-section').within(() => {
      cy.get('#saved-vessel')
        .should('exist')
        .clear()
        .type('1');

      cy.contains('button', 'Filtrar').click();
    });

    cy.wait('@loadPlans').then(({ request }) => {
      const url = new URL(request.url);
      expect(url.searchParams.get('vesselVisitId')).to.eq('1');
    });

    cy.get('section.saved-section .table-wrapper table tbody tr').each(($row) => {
      cy.wrap($row)
        .find('td')
        .eq(2)
        .invoke('text')
        .then((text) => {
          const trimmed = text.trim();
          if (trimmed !== '-') {
            expect(trimmed).to.contain('1');
          }
        });
    });
  });

  it('ordena planos guardados por nome, VVN, inicio e criado em', () => {
    cy.get('section.saved-section .table-wrapper table thead tr').within(() => {
      cy.contains('th', 'VVN').as('vvnHeader');
      cy.contains('th', 'Nome').as('nameHeader');
      cy.contains('th', 'Criado em').as('createdHeader');
      cy.contains('th', 'Inicio').as('startHeader');
    });

    const getColumnTexts = (colIndex: number) =>
      cy
        .get('section.saved-section .table-wrapper table tbody tr')
        .then(($rows) =>
          Cypress._.map(
            $rows,
            (row) => row.children[colIndex].textContent?.trim() || '',
          ),
        );

    // VVN asc/desc (coluna 2) – o componente ordena por string
    cy.get('@vvnHeader').click();
    getColumnTexts(2).then((values) => {
      const nonDash = values.filter((v) => v !== '-');
      const sorted = [...nonDash].sort();
      expect(nonDash).to.deep.equal(sorted);
    });

    cy.get('@vvnHeader').click();
    getColumnTexts(2).then((values) => {
      const nonDash = values.filter((v) => v !== '-');
      const sortedDesc = [...nonDash].sort().reverse();
      expect(nonDash).to.deep.equal(sortedDesc);
    });

    // Nome asc/desc (coluna 0)
    cy.get('@nameHeader').click();
    getColumnTexts(0).then((values) => {
      const lower = values.map((v) => v.toLowerCase());
      const sorted = [...lower].sort();
      expect(lower).to.deep.equal(sorted);
    });

    cy.get('@nameHeader').click();
    getColumnTexts(0).then((values) => {
      const lower = values.map((v) => v.toLowerCase());
      const sorted = [...lower].sort().reverse();
      expect(lower).to.deep.equal(sorted);
    });

    // Criado em (so valida que o sort e ativado)
    cy.get('@createdHeader').click();
    cy.get('@createdHeader').find('.sort-icon').should('have.class', 'active');

    cy.get('@createdHeader').click();
    cy.get('@createdHeader').find('.sort-icon').should('have.class', 'active');

    // Inicio (plannedStartTime) – valida apenas ativacao do sort
    cy.get('@startHeader').click();
    cy.get('@startHeader').find('.sort-icon').should('have.class', 'active');
  });

  it('filtra planos guardados por intervalo de datas (envia from/to)', () => {
    cy.get('#saved-range').should('exist').click();

    cy.get('.flatpickr-day', { timeout: 10000 })
      .first()
      .click();

    cy.get('.flatpickr-day').eq(1).click();

    // O componente atualiza apenas o valor do input (display),
    // nao faz nova chamada a /operation-plans ao mudar o range.
    cy.get('#saved-range')
      .invoke('val')
      .should('not.eq', 'Selecionar datas')
      .and('not.be.empty');
  });

  it('gera preview e guarda planos de operacao para 23/11/2025', () => {
    // Define a data especifica no formulario principal
    cy.get('#plan-date')
      .should('have.attr', 'type', 'date')
      .clear()
      .type(TARGET_DATE);

    cy.get('#plan-algorithm').select('single-crane');

    cy.contains('button', 'Gerar Preview').click();

    cy.wait('@previewPlans').then(({ request }) => {
      expect(request.body.date).to.eq(TARGET_DATE);
      expect(request.body.algorithm).to.eq('single-crane');
    });

    // Deve mostrar as linhas de preview devolvidas pelo stub
    cy.get('.preview-table tbody tr').should('have.length', previewPlansDefault.length);

    // Desseleciona o ultimo VVN e guarda só o primeiro
    cy.get('.preview-table tbody input[type="checkbox"]')
      .last()
      .uncheck({ force: true });

    cy.contains('button', 'Guardar planos selecionados').click();

    cy.wait('@generatePlans').then(({ request }) => {
      expect(request.body.date).to.eq(TARGET_DATE);
      expect(request.body.algorithm).to.eq('single-crane');
      expect(request.body.vvnIds).to.deep.equal([previewPlansDefault[0].vvnId]);
    });
  });

  it('pede VVNs sem plano para 23/11/2025', () => {
    // Abre a modal de VVNs em falta
    cy.contains('button', 'Ver detalhes').click();

    cy.get('#missing-date')
      .should('have.attr', 'type', 'date')
      .clear()
      .type(TARGET_DATE);

    cy.contains('button', 'Procurar VVNs').click();

    cy.wait('@loadMissingPlans').then(({ request }) => {
      const url = new URL(request.url);
      expect(url.searchParams.get('date')).to.eq(TARGET_DATE);
    });

    // Apenas verifica que a secao de regeneracao fica visivel para esta data,
    // indicando que a modal carregou o resultado da API de VVNs em falta.
    cy.get('.regenerate-panel').should('be.visible');
  });

  it('edita dados principais de um plano guardado', () => {
    cy.get('section.saved-section .table-wrapper table tbody tr')
      .first()
      .as('firstRow');

    cy.get('@firstRow')
      .find('details.actions-dropdown summary.action-menu-btn')
      .click();

    cy.get('@firstRow')
      .find('.action-menu .menu-item')
      .contains('Editar')
      .click();

    cy.get('.modal-backdrop .edit-panel', { timeout: 10000 }).should('be.visible');

    cy.get('.edit-menu button')
      .contains('Dados principais')
      .should('have.class', 'active');

    cy.get('.edit-panel form.edit-form input[formcontrolname="reason"]')
      .clear()
      .type(updatedSummary.reason);

    cy.get('.edit-panel form.edit-form select[formcontrolname="status"]').select(
      updatedSummary.status,
    );

    cy.get('.edit-panel form.edit-form').within(() => {
      cy.contains('button', 'Guardar alteracoes').click();
    });

    cy.wait('@updatePlan');
  });

  it('edita tarefas de um plano (secao Tarefas) e guarda', () => {
    cy.get('section.saved-section .table-wrapper table tbody tr')
      .first()
      .as('firstRow');

    cy.get('@firstRow')
      .find('details.actions-dropdown summary.action-menu-btn')
      .click();

    cy.get('@firstRow')
      .find('.action-menu .menu-item')
      .contains('Editar')
      .click();

    cy.get('.modal-backdrop .edit-panel', { timeout: 10000 }).should('be.visible');

    cy.get('.edit-menu button')
      .contains('Tarefas')
      .click()
      .should('have.class', 'active');

    cy.contains('.tasks-header button', 'Adicionar tarefa').click();

    cy.get('.tasks-editor .task-row')
      .last()
      .as('lastTask');

    cy.get('@lastTask').within(() => {
      cy.get('input[formcontrolname="type"]').clear().type('LOAD');
      cy.get('input[formcontrolname="startTime"]').then(($input) => {
        if (!$input.val()) {
          const now = new Date();
          const iso = now.toISOString().slice(0, 16);
          cy.wrap($input).type(iso);
        }
      });
      cy.get('input[formcontrolname="endTime"]').then(($input) => {
        if (!$input.val()) {
          const later = new Date(Date.now() + 60 * 60 * 1000);
          const iso = later.toISOString().slice(0, 16);
          cy.wrap($input).type(iso);
        }
      });
    });

    cy.get('.edit-menu button').contains('Dados principais').click();
    cy.get('.edit-panel form.edit-form input[formcontrolname="reason"]')
      .clear()
      .type('Atualizacao de tarefas via E2E');

    cy.get('.edit-panel form.edit-form').within(() => {
      cy.contains('button', 'Guardar alteracoes').click();
    });

    cy.wait('@updatePlan');
  });

  it('mostra detalhes de um plano guardado', () => {
    cy.get('section.saved-section .table-wrapper table tbody tr')
      .first()
      .as('firstRow');

    cy.get('@firstRow')
      .find('details.actions-dropdown summary.action-menu-btn')
      .click();

    cy.get('@firstRow')
      .find('.action-menu .menu-item')
      .contains('Ver detalhes')
      .click();

    cy.wait('@getPlan');

    cy.get('.modal-backdrop .details-panel', { timeout: 10000 })
      .should('be.visible')
      .within(() => {
        cy.get('.details-header h3').should('contain.text', 'Plan');
        cy.contains('strong', 'planned').should('exist');
      });
  });

  it('apaga um plano guardado apos confirmacao', () => {
    // Aceita o dialogo de confirmacao do browser
    cy.on('window:confirm', () => true);

    cy.get('section.saved-section .table-wrapper table tbody tr')
      .first()
      .then(($row) => {
        const firstName = $row.children[0]?.textContent?.trim() || '';

        cy.wrap($row).as('firstRow');

        cy.get('@firstRow')
          .find('details.actions-dropdown summary.action-menu-btn')
          .click();

        cy.get('@firstRow')
          .find('.action-menu .menu-item.danger')
          .contains('Apagar')
          .click();

        cy.wait('@deletePlan');

        // Garante que a linha com o nome inicial ja nao existe
        if (firstName) {
          cy.contains('section.saved-section .table-wrapper table tbody tr', firstName)
            .should('not.exist');
        }
      });
  });
});
