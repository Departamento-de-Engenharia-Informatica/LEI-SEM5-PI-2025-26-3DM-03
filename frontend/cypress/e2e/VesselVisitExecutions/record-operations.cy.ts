describe('Vessel Visit Executions - Complete execution', () => {
	const userStub = {
		name: 'DevLapr5 salvador',
		email: 'salvadordevlapr@gmail.com',
		role: 'admin',
		roles: ['admin'],
	};

	const initialExecution = {
		id: 90383,
		vesselVisitNotificationId: 9010383,
		vesselVisitId: 9010383,
		vesselName: 'Vessel Horizon',
		berthId: '1',
		status: 'in-progress',
		actualArrivalTime: '2025-12-31T11:43:00.000Z',
		actualBerthTime: '2025-12-31T12:20:00.000Z',
		actualUnberthTime: null,
		actualDepartureTime: null,
		operationPlanId: 440,
		totalTurnaroundMinutes: null,
		berthOccupancyMinutes: null,
		waitingForBerthMinutes: 6,
		arrivalDelayMinutes: null,
		departureDelayMinutes: null,
		operationsDelayMinutes: null,
	};

	const unberthInput = '2025-12-31T14:10';
	const departureInput = '2025-12-31T15:05';
	const expectedUnberthIso = new Date(unberthInput).toISOString();
	const expectedDepartureIso = new Date(departureInput).toISOString();

	let executionsStub: typeof initialExecution[];

	beforeEach(() => {
		executionsStub = [{ ...initialExecution }];

		cy.loginAsAdmin();

		cy.intercept('GET', '**/authtest/me', {
			statusCode: 200,
			body: userStub,
		}).as('authMe');

		cy.intercept('GET', '**/api/Docks*', {
			statusCode: 200,
			body: [],
		}).as('loadDocks');

		cy.intercept('GET', '**/api/VesselVisitNotifications*', {
			statusCode: 200,
			body: [],
		}).as('loadVvns');

		cy.intercept('GET', '**/api/oem/vessel-visit-executions*', (req) => {
			req.reply({
				statusCode: 200,
				body: executionsStub,
			});
		}).as('loadExecutions');

		cy.intercept('PATCH', '**/api/oem/vessel-visit-executions/*/complete', (req) => {
			const parts = req.url.split('/');
			const id = Number(parts[parts.length - 2]);
			expect(id).to.eq(initialExecution.id);
			expect(req.body).to.deep.equal({
				actualUnberthTime: expectedUnberthIso,
				actualPortDepartureTime: expectedDepartureIso,
			});

			const updatedRecord = {
				...executionsStub[0],
				status: 'completed',
				actualUnberthTime: expectedUnberthIso,
				actualDepartureTime: expectedDepartureIso,
			};

			executionsStub = [updatedRecord];

			req.reply({
				statusCode: 200,
				body: updatedRecord,
			});
		}).as('completeExecution');

		cy.visit('/oem/vessel-visit-executions');
		cy.wait('@authMe');
		cy.wait('@loadDocks');
		cy.wait('@loadVvns');
		cy.wait('@loadExecutions');
	});

	it('marks an execution as completed', () => {
		cy.contains('tbody tr', initialExecution.vesselName).within(() => {
			cy.get('summary.action-menu-btn').click();
			cy.contains('button', 'Marcar como concluida').click();
		});

		cy.contains(
			'section.action-panel',
			`Concluir execucao VVE ${initialExecution.id} · VVN ${initialExecution.vesselVisitNotificationId} (${initialExecution.vesselName})`,
		)
			.should('be.visible')
			.within(() => {
				cy.get('input[formcontrolname="actualUnberthTime"]').clear().type(unberthInput);
				cy.get('input[formcontrolname="actualPortDepartureTime"]').clear().type(departureInput);
				cy.contains('button', 'Concluir execucao').click();
			});

		cy.wait('@completeExecution');
		cy.wait('@loadExecutions');

		cy.contains(
			'section.action-panel',
			`Concluir execucao VVE ${initialExecution.id} · VVN ${initialExecution.vesselVisitNotificationId} (${initialExecution.vesselName})`,
		).should('not.exist');

		cy.contains('.success', 'Execucao concluida com sucesso.').should('be.visible');

		cy.contains('tbody tr', initialExecution.vesselName).within(() => {
			cy.get('td')
				.eq(4)
				.invoke('text')
				.then((text) => {
					expect(text.trim().toLowerCase()).to.eq('completed');
				});
			cy.get('td')
				.eq(7)
				.should(($cell) => {
					expect($cell.text().trim()).to.not.eq('-');
				});
			cy.get('td')
				.eq(8)
				.should(($cell) => {
					expect($cell.text().trim()).to.not.eq('-');
				});
		});
	});
});
