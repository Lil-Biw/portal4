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
        
        # -> Abrir la página de inicio de sesión de administrador (Accede aquí / página de login-admin) para autenticar como superadmin.
        await page.goto("http://localhost:4200/login-admin")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Rellenar el correo y la contraseña y hacer clic en el botón 'Ingresar al portal' para autenticar como superadmin.
        # admin@smartclarity.cl email field
        elem = page.get_by_placeholder('admin@smartclarity.cl', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("superadmin@eclariti.local")
        
        # -> Rellenar el correo y la contraseña y hacer clic en el botón 'Ingresar al portal' para autenticar como superadmin.
        # •••••••• password field
        elem = page.get_by_placeholder('••••••••', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Demo1234!")
        
        # -> Rellenar el correo y la contraseña y hacer clic en el botón 'Ingresar al portal' para autenticar como superadmin.
        # button
        elem = page.locator('xpath=/html/body/app-root/app-login-admin-page/div/div[2]/div/form/div[2]/div/button')
        await elem.click(timeout=10000)
        
        # -> Click the 'Ingresar al portal' button to submit admin credentials and reach the admin dashboard.
        # Ingresar al portal button
        elem = page.get_by_role('button', name='Ingresar al portal', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Actividades' link in the sidebar to open the Activities section.
        # Actividades link
        elem = page.get_by_role('link', name='Actividades', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the calendar day cell labeled '24' (Julio 2026) to open the create-activity wizard for that date.
        # 24 testactividad test 4 correo documentos
        elem = page.get_by_text('24 testactividad test 4 correo documentos', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Cancelar' button to close the open activity modal, then click an empty day cell in the calendar month view to open the creation wizard with the clicked date pre-filled.
        # Cancelar button
        elem = page.get_by_role('button', name='Cancelar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Cancelar' button to close the open activity modal, then click an empty day cell in the calendar month view to open the creation wizard with the clicked date pre-filled.
        # 1
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[34]')
        await elem.click(timeout=10000)
        
        # -> Fill the 'Nombre' field with 'Test Calendario CAL03' and open the 'Tipo' dropdown in the creation wizard.
        # Nombre de la actividad text field
        elem = page.get_by_placeholder('Nombre de la actividad', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Test Calendario CAL03")
        
        # -> Fill the 'Nombre' field with 'Test Calendario CAL03' and open the 'Tipo' dropdown in the creation wizard.
        # Selecciona un tipo button
        elem = page.get_by_role('button', name='Selecciona un tipo', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select 'Auditoría de Seguridad' from the 'Tipo' dropdown and open the 'Empresa' select so its options appear.
        # Auditoría de Seguridad button
        elem = page.get_by_text('Selecciona un tipo', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Auditoría de Seguridad', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select 'Auditoría de Seguridad' from the 'Tipo' dropdown and open the 'Empresa' select so its options appear.
        # Selecciona una empresa AgroSur Ltda. Constructora... dropdown
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div/select')
        await elem.click(timeout=10000)
        
        # -> Seleccionar 'AgroSur Ltda.' en el desplegable 'Empresa' dentro del wizard de 'Nueva actividad'.
        # Selecciona una empresa AgroSur Ltda. Constructora... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Select 'Fundo San Rafael' in the 'Centro de costos' dropdown and click the 'Siguiente →' button to proceed to the Notificaciones step.
        # Selecciona un centro Fundo San Rafael Maquinaria... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Select 'Fundo San Rafael' in the 'Centro de costos' dropdown and click the 'Siguiente →' button to proceed to the Notificaciones step.
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Siguiente →' button in the wizard to advance from Notificaciones to the next step.
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Siguiente →' button to advance to the Resumen (Paso 4) of the 'Nueva actividad' wizard.
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Guardar ✓' button to save the new activity and then verify the modal closes and the event chip 'Test Calendario CAL03' appears in the calendar cell for 2026-08-01.
        # Guardar ✓ button
        elem = page.get_by_role('button', name='Guardar ✓', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the modal closes and a colored event chip with the name 'Test Calendario CAL03' now appears in the calendar cell for the date that was clicked
        await page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[34]/div/div").nth(0).scroll_into_view_if_needed()
        # Assert: The event chip 'Test Calendario CAL03' is visible in the clicked calendar cell.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[34]/div/div").nth(0)).to_be_visible(timeout=15000), "The event chip 'Test Calendario CAL03' is visible in the clicked calendar cell."
        # Assert: The calendar event chip text equals 'Test Calendario CAL03'.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[34]/div/div").nth(0)).to_have_text("Test Calendario CAL03", timeout=15000), "The calendar event chip text equals 'Test Calendario CAL03'."
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
    