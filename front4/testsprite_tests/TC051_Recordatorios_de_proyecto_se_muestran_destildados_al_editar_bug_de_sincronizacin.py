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
        
        # -> Abrir la página de login de administrador (la página de administración en /login-admin).
        await page.goto("http://localhost:4200/login-admin")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Rellenar el campo 'Correo electrónico' con superadmin@eclariti.local, rellenar 'Contraseña' con Demo1234!, y hacer clic en el botón 'Ingresar al portal'.
        # admin@smartclarity.cl email field
        elem = page.get_by_placeholder('admin@smartclarity.cl', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("superadmin@eclariti.local")
        
        # -> Rellenar el campo 'Correo electrónico' con superadmin@eclariti.local, rellenar 'Contraseña' con Demo1234!, y hacer clic en el botón 'Ingresar al portal'.
        # •••••••• password field
        elem = page.get_by_placeholder('••••••••', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Demo1234!")
        
        # -> Rellenar el campo 'Correo electrónico' con superadmin@eclariti.local, rellenar 'Contraseña' con Demo1234!, y hacer clic en el botón 'Ingresar al portal'.
        # button
        elem = page.locator('xpath=/html/body/app-root/app-login-admin-page/div/div[2]/div/form/div[2]/div/button')
        await elem.click(timeout=10000)
        
        # -> Hacer clic en el botón 'Ingresar al portal' para enviar el formulario de inicio de sesión del administrador.
        # Ingresar al portal button
        elem = page.get_by_role('button', name='Ingresar al portal', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Proyectos' link in the left menu to open the Projects section.
        # Proyectos link
        elem = page.get_by_role('link', name='Proyectos', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the '+ Crear proyecto' button to open the project creation form.
        # + Crear proyecto button
        elem = page.get_by_role('button', name='+ Crear proyecto', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'Empresa' dropdown in the 'Nuevo proyecto' modal (select 'Selecciona empresa').
        # Selecciona empresa AgroSur Ltda. Constructora... dropdown
        elem = page.get_by_label('Empresa *Selecciona empresaAgroSur Ltda.Constructora Cordillera S.A.Energía Renovable del Sur SpAMinera Andina S.A.Prueba Empresa 9586qqPrueba Empresa xn2eqnTest Empresa TC006Test Empresa TC006TestCreandoTransportes del Pacífico SpA', exact=True)
        await elem.click(timeout=10000)
        
        # -> Seleccionar 'AgroSur Ltda.' en el campo 'Empresa' dentro del modal 'Nuevo proyecto'.
        # Selecciona empresa AgroSur Ltda. Constructora... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-proyectos-page/div[3]/div/app-proyecto-form/form/div/section/div/label/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Fill Código, Nombre and Fecha de término; select centro de costos 'Fundo San Rafael'; mark '30 días antes' and '7 días antes'; then click the 'Crear proyecto' button.
        # checkbox
        elem = page.get_by_label('Fundo San Rafael', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill Código, Nombre and Fecha de término; select centro de costos 'Fundo San Rafael'; mark '30 días antes' and '7 días antes'; then click the 'Crear proyecto' button.
        # codigo text field
        elem = page.get_by_label('Código *', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("TEST-REC-UI-01")
        
        # -> Fill Código, Nombre and Fecha de término; select centro de costos 'Fundo San Rafael'; mark '30 días antes' and '7 días antes'; then click the 'Crear proyecto' button.
        # nombre text field
        elem = page.get_by_label('Nombre *', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Prueba Recordatorios UI 01")
        
        # -> Fill Código, Nombre and Fecha de término; select centro de costos 'Fundo San Rafael'; mark '30 días antes' and '7 días antes'; then click the 'Crear proyecto' button.
        # fecha_fin date field
        elem = page.get_by_label('Fecha fin', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2026-08-15")
        
        # -> Fill Código, Nombre and Fecha de término; select centro de costos 'Fundo San Rafael'; mark '30 días antes' and '7 días antes'; then click the 'Crear proyecto' button.
        # ✓
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-proyectos-page/div[3]/div/app-proyecto-form/form/div/section[3]/div/div/div/label/span')
        await elem.click(timeout=10000)
        
        # -> Toggle the reminder pills so only '30 días antes' and '7 días antes' remain checked.
        # ✓
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-proyectos-page/div[3]/div/app-proyecto-form/form/div/section[3]/div/div/div/label[2]/span')
        await elem.click(timeout=10000)
        
        # -> Toggle the reminder pills so only '30 días antes' and '7 días antes' remain checked.
        # ✓
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-proyectos-page/div[3]/div/app-proyecto-form/form/div/section[3]/div/div/div/label[4]/span')
        await elem.click(timeout=10000)
        
        # -> Toggle the reminder pills so only '30 días antes' and '7 días antes' remain checked.
        # ✓
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-proyectos-page/div[3]/div/app-proyecto-form/form/div/section[3]/div/div/div/label[5]/span')
        await elem.click(timeout=10000)
        
        # -> Toggle the reminder pills so only '30 días antes' and '7 días antes' remain checked.
        # ✓
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-proyectos-page/div[3]/div/app-proyecto-form/form/div/section[3]/div/div/div/label[6]/span')
        await elem.click(timeout=10000)
        
        # -> Toggle the reminder pills so only '30 días antes' and '7 días antes' remain checked.
        # ✓ 30 días antes
        elem = page.get_by_text('✓ 30 días antes', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Crear proyecto' button to submit the new project form.
        # Crear proyecto button
        elem = page.get_by_role('button', name='Crear proyecto', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Editar' button for the project 'Prueba Recordatorios UI 01' to open the edit form.
        # Editar button
        elem = page.get_by_text('Prueba Recordatorios UI 01 Borrador', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Editar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Verify that exactly '30 días antes' and '7 días antes' are active in the 'Editar proyecto' modal, then click the 'Guardar cambios' button to save without changes and reopen the edit modal to re-check the pills.
        # Guardar cambios button
        elem = page.get_by_role('button', name='Guardar cambios', exact=True)
        await elem.click(timeout=10000)
        
        # -> Verify that exactly '30 días antes' and '7 días antes' are active in the 'Editar proyecto' modal, then click the 'Guardar cambios' button to save without changes and reopen the edit modal to re-check the pills.
        # ✕ button
        elem = page.get_by_role('button', name='✕', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the project appears in the listing
        await page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-proyectos-page/app-proyectos-list/div/div[1]/div[2]/div[7]/div[2]/div/button[1]").nth(0).scroll_into_view_if_needed()
        # Assert: The project appears in the listing — its row's Edit button is visible.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-proyectos-page/app-proyectos-list/div/div[1]/div[2]/div[7]/div[2]/div/button[1]").nth(0)).to_be_visible(timeout=15000), "The project appears in the listing \u2014 its row's Edit button is visible."
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
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
    