import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:4200")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the '¿Eres administrador? Accede aquí' link to open the administrator login page.
        # Accede aquí link
        elem = page.get_by_role('link', name='Accede aquí', exact=True)
        await elem.click(timeout=10000)
        
        # -> Rellenar 'Correo electrónico' con superadmin@eclariti.local, rellenar 'Contraseña' con Demo1234! y pulsar el botón 'Ingresar al portal'.
        # admin@smartclarity.cl email field
        elem = page.get_by_placeholder('admin@smartclarity.cl', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("superadmin@eclariti.local")
        
        # -> Rellenar 'Correo electrónico' con superadmin@eclariti.local, rellenar 'Contraseña' con Demo1234! y pulsar el botón 'Ingresar al portal'.
        # •••••••• password field
        elem = page.get_by_placeholder('••••••••', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Demo1234!")
        
        # -> Rellenar 'Correo electrónico' con superadmin@eclariti.local, rellenar 'Contraseña' con Demo1234! y pulsar el botón 'Ingresar al portal'.
        # button
        elem = page.locator('xpath=/html/body/app-root/app-login-admin-page/div/div[2]/div/form/div[2]/div/button')
        await elem.click(timeout=10000)
        
        # -> Click the 'Ingresar al portal' button to submit the admin login form and proceed to the admin panel.
        # Ingresar al portal button
        elem = page.get_by_role('button', name='Ingresar al portal', exact=True)
        await elem.click(timeout=10000)
        
        # -> Hacer click en el enlace 'Proyectos' del menú lateral para abrir la sección de gestión de proyectos.
        # Proyectos link
        elem = page.get_by_role('link', name='Proyectos', exact=True)
        await elem.click(timeout=10000)
        
        # -> Hacer click en el botón '+ Crear proyecto' para abrir el modal de creación del proyecto.
        # + Crear proyecto button
        elem = page.get_by_role('button', name='+ Crear proyecto', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'Empresa' dropdown in the 'Nuevo proyecto' modal so the company 'AgroSur Ltda.' can be selected (context-setting field).
        # Selecciona empresa AgroSur Ltda. Constructora... dropdown
        elem = page.get_by_label('Empresa *Selecciona empresaAgroSur Ltda.Constructora Cordillera S.A.Energía Renovable del Sur SpAMinera Andina S.A.Prueba Empresa 9586qqPrueba Empresa xn2eqnTest Empresa TC006Test Empresa TC006TestCreandoTransportes del Pacífico SpA', exact=True)
        await elem.click(timeout=10000)
        
        # -> Seleccionar 'AgroSur Ltda.' en el desplegable 'Empresa' dentro del modal 'Nuevo proyecto'.
        # Selecciona empresa AgroSur Ltda. Constructora... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-proyectos-page/div[3]/div/app-proyecto-form/form/div/section/div/label/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Select the 'Fundo San Rafael' checkbox in the 'Centros de costos' section of the 'Nuevo proyecto' modal.
        # checkbox
        elem = page.get_by_label('Fundo San Rafael', exact=True)
        await elem.click(timeout=10000)
        
        # -> Rellenar 'Código' con 'TEST-REC-01' y 'Nombre' con 'Proyecto Test Recordatorios', mantener los pills por defecto y pulsar el botón 'Crear proyecto'.
        # codigo text field
        elem = page.get_by_label('Código *', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("TEST-REC-01")
        
        # -> Rellenar 'Código' con 'TEST-REC-01' y 'Nombre' con 'Proyecto Test Recordatorios', mantener los pills por defecto y pulsar el botón 'Crear proyecto'.
        # nombre text field
        elem = page.get_by_label('Nombre *', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Proyecto Test Recordatorios")
        
        # -> Rellenar 'Código' con 'TEST-REC-01' y 'Nombre' con 'Proyecto Test Recordatorios', mantener los pills por defecto y pulsar el botón 'Crear proyecto'.
        # Crear proyecto button
        elem = page.get_by_role('button', name='Crear proyecto', exact=True)
        await elem.click(timeout=10000)
        
        # -> Close the 'Nuevo proyecto' modal and click the 'Editar' button in the table row for 'Proyecto Test Recordatorios' to open the edit modal.
        # ✕ button
        elem = page.get_by_role('button', name='✕', exact=True)
        await elem.click(timeout=10000)
        
        # -> Close the 'Nuevo proyecto' modal and click the 'Editar' button in the table row for 'Proyecto Test Recordatorios' to open the edit modal.
        # Editar button
        elem = page.get_by_text('Proyecto Test Recordatorios Borrador', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Editar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Check each reminder pill ('30 días antes', '15 días antes', '7 días antes', '3 días antes', '1 día antes', 'El día de término') inside the 'Editar proyecto' modal to see whether it has the 'pf-pill--on' class; then change 'Nombre' to 'Pr...
        # nombre text field
        elem = page.get_by_label('Nombre *', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Proyecto Test Recordatorios Editado")
        
        # -> Check each reminder pill ('30 días antes', '15 días antes', '7 días antes', '3 días antes', '1 día antes', 'El día de término') inside the 'Editar proyecto' modal to see whether it has the 'pf-pill--on' class; then change 'Nombre' to 'Pr...
        # Guardar cambios button
        elem = page.get_by_role('button', name='Guardar cambios', exact=True)
        await elem.click(timeout=10000)
        
        # -> Check the six reminder pills ('30 días antes', '15 días antes', '7 días antes', '3 días antes', '1 día antes', 'El día de término') in the 'Editar proyecto' modal and report whether each has the 'pf-pill--on' class.
        # nombre text field
        elem = page.get_by_label('Nombre *', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Proyecto Test Recordatorios Editado")
        
        # --> Assertions to verify final state
        
        # --> Inside this edit modal specifically, check the class attribute of each of the 6 reminder day pills (labeled '30 dias antes', '15 dias antes', '7 dias antes', '3 dias antes', '1 dia antes', 'El dia de termino'): report explicitly whether each pill has the checked/active class (e.g. containing 'pf-pill--on') or is missing it (unchecked). This is the key observation of the test.
        # Assert: Verifica que el pill '30 días antes' está marcado (contiene '✓').
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-proyectos-page/div[3]/div/app-proyecto-form/form/div[1]/section[3]/div/div/div/label[1]").nth(0)).to_contain_text("\u2713", timeout=15000), "Verifica que el pill '30 d\u00edas antes' est\u00e1 marcado (contiene '\u2713')."
        # Assert: Verifica que el pill '15 días antes' está marcado (contiene '✓').
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-proyectos-page/div[3]/div/app-proyecto-form/form/div[1]/section[3]/div/div/div/label[2]").nth(0)).to_contain_text("\u2713", timeout=15000), "Verifica que el pill '15 d\u00edas antes' est\u00e1 marcado (contiene '\u2713')."
        # Assert: Verifica que el pill '7 días antes' está marcado (contiene '✓').
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-proyectos-page/div[3]/div/app-proyecto-form/form/div[1]/section[3]/div/div/div/label[3]").nth(0)).to_contain_text("\u2713", timeout=15000), "Verifica que el pill '7 d\u00edas antes' est\u00e1 marcado (contiene '\u2713')."
        # Assert: Verifica que el pill '3 días antes' está marcado (contiene '✓').
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-proyectos-page/div[3]/div/app-proyecto-form/form/div[1]/section[3]/div/div/div/label[4]").nth(0)).to_contain_text("\u2713", timeout=15000), "Verifica que el pill '3 d\u00edas antes' est\u00e1 marcado (contiene '\u2713')."
        # Assert: Verifica que el pill '1 día antes' está marcado (contiene '✓').
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-proyectos-page/div[3]/div/app-proyecto-form/form/div[1]/section[3]/div/div/div/label[5]").nth(0)).to_contain_text("\u2713", timeout=15000), "Verifica que el pill '1 d\u00eda antes' est\u00e1 marcado (contiene '\u2713')."
        # Assert: Verifica que el pill 'El día de término' está marcado (contiene '✓').
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-proyectos-page/div[3]/div/app-proyecto-form/form/div[1]/section[3]/div/div/div/label[6]").nth(0)).to_contain_text("\u2713", timeout=15000), "Verifica que el pill 'El d\u00eda de t\u00e9rmino' est\u00e1 marcado (contiene '\u2713')."
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    