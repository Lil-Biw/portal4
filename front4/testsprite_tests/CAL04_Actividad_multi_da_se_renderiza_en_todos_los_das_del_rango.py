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
        
        # -> Abrir la página de inicio de sesión de administradores (vínculo visible: '¿Eres administrador? Accede aquí' / ruta de admin) para iniciar sesión como superadmin.
        await page.goto("http://localhost:4200/login-admin")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Sign in using the 'Ingresar al portal' form with email superadmin@eclariti.local and password Demo1234! to access the admin panel.
        # admin@smartclarity.cl email field
        elem = page.get_by_placeholder('admin@smartclarity.cl', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("superadmin@eclariti.local")
        
        # -> Sign in using the 'Ingresar al portal' form with email superadmin@eclariti.local and password Demo1234! to access the admin panel.
        # •••••••• password field
        elem = page.get_by_placeholder('••••••••', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Demo1234!")
        
        # -> Sign in using the 'Ingresar al portal' form with email superadmin@eclariti.local and password Demo1234! to access the admin panel.
        # button
        elem = page.locator('xpath=/html/body/app-root/app-login-admin-page/div/div[2]/div/form/div[2]/div/button')
        await elem.click(timeout=10000)
        
        # -> Click the 'Ingresar al portal' button to submit the admin login form and access the admin panel.
        # Ingresar al portal button
        elem = page.get_by_role('button', name='Ingresar al portal', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Actividades' link in the sidebar to open the Activities section (admin).
        # Actividades link
        elem = page.get_by_role('link', name='Actividades', exact=True)
        await elem.click(timeout=10000)
        
        # -> Hacer clic en el botón '+ Nueva actividad' para abrir el asistente de creación y observar todos los campos del formulario.
        # + Nueva actividad button
        elem = page.get_by_role('button', name='+ Nueva actividad', exact=True)
        await elem.click(timeout=10000)
        
        # -> Rellenar 'Nombre' con 'Test Rango CAL04' y abrir el desplegable 'Empresa'.
        # Nombre de la actividad text field
        elem = page.get_by_placeholder('Nombre de la actividad', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Test Rango CAL04")
        
        # -> Rellenar 'Nombre' con 'Test Rango CAL04' y abrir el desplegable 'Empresa'.
        # Selecciona una empresa AgroSur Ltda. Constructora... dropdown
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div/select')
        await elem.click(timeout=10000)
        
        # -> Seleccionar 'AgroSur Ltda.' en el campo Empresa del formulario de 'Nueva actividad' y esperar a que el campo 'Centro de costos' se habilite.
        # Selecciona una empresa AgroSur Ltda. Constructora... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Open the 'Centro de costos' dropdown (label: 'Centro de costos *') so the available cost center options are displayed.
        # Selecciona un centro Fundo San Rafael Maquinaria... dropdown
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div[2]/select')
        await elem.click(timeout=10000)
        
        # -> Select 'Fundo San Rafael' in the 'Centro de costos' dropdown in the 'Nueva actividad' modal.
        # Selecciona un centro Fundo San Rafael Maquinaria... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Open the 'Tipo *' dropdown (label: 'Selecciona un tipo') in the 'Nueva actividad' modal and choose a type so dependent fields can appear.
        # Selecciona un tipo button
        elem = page.get_by_role('button', name='Selecciona un tipo', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select the 'Auditoría de Seguridad' option from the 'Tipo' dropdown in the 'Nueva actividad' modal.
        # Auditoría de Seguridad button
        elem = page.get_by_text('Selecciona un tipo', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Auditoría de Seguridad', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill 'Fecha' with 2026-07-27 and 'Fecha de término' with 2026-07-30, then click the 'Siguiente →' button to proceed in the wizard.
        # date field
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div/div[2]/div/input')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2026-07-27")
        
        # -> Fill 'Fecha' with 2026-07-27 and 'Fecha de término' with 2026-07-30, then click the 'Siguiente →' button to proceed in the wizard.
        # date field
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div/div[2]/div[2]/input')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2026-07-30")
        
        # -> Fill 'Fecha' with 2026-07-27 and 'Fecha de término' with 2026-07-30, then click the 'Siguiente →' button to proceed in the wizard.
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Siguiente →' button in the activity modal to advance from 'Notificaciones' (Paso 2) to 'Documentos' (Paso 3).
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Siguiente →' button in the activity modal to advance to 'Resumen' (Paso 4) so the activity can be saved.
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Guardar ✓' button in the activity modal to save 'Test Rango CAL04'.
        # Guardar ✓ button
        elem = page.get_by_role('button', name='Guardar ✓', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the event chip 'Test Rango CAL04' appears in the calendar on the start day, and also on the middle day(s) and the end day of the range (4 consecutive day cells total)
        await page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[29]/div/div[4]").nth(0).scroll_into_view_if_needed()
        # Assert: The event chip 'Test Rango CAL04' is visible on the start day.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[29]/div/div[4]").nth(0)).to_be_visible(timeout=15000), "The event chip 'Test Rango CAL04' is visible on the start day."
        await page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[30]/div/div[2]").nth(0).scroll_into_view_if_needed()
        # Assert: The event chip 'Test Rango CAL04' is visible on the first middle day of the range.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[30]/div/div[2]").nth(0)).to_be_visible(timeout=15000), "The event chip 'Test Rango CAL04' is visible on the first middle day of the range."
        await page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[31]/div/div[2]").nth(0).scroll_into_view_if_needed()
        # Assert: The event chip 'Test Rango CAL04' is visible on the second middle day of the range.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[31]/div/div[2]").nth(0)).to_be_visible(timeout=15000), "The event chip 'Test Rango CAL04' is visible on the second middle day of the range."
        await page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[32]/div/div[2]").nth(0).scroll_into_view_if_needed()
        # Assert: The event chip 'Test Rango CAL04' is visible on the end day.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[32]/div/div[2]").nth(0)).to_be_visible(timeout=15000), "The event chip 'Test Rango CAL04' is visible on the end day."
        
        # --> Verify the chip visually differs between start ('inicio'), middle ('medio') and end ('fin') days (e.g. rounded on one side only for start/end, continuous for middle), confirming posicionActividadEnDia works correctly
        # Assert: Start-day chip uses the class 'cal-event-chip cal-event-chip--inicio'.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[29]/div/div[4]").nth(0)).to_have_attribute("class", "cal-event-chip cal-event-chip--inicio", timeout=15000), "Start-day chip uses the class 'cal-event-chip cal-event-chip--inicio'."
        # Assert: Middle-day chip (1) uses the class 'cal-event-chip cal-event-chip--medio'.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[30]/div/div[2]").nth(0)).to_have_attribute("class", "cal-event-chip cal-event-chip--medio", timeout=15000), "Middle-day chip (1) uses the class 'cal-event-chip cal-event-chip--medio'."
        # Assert: Middle-day chip (2) uses the class 'cal-event-chip cal-event-chip--medio'.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[31]/div/div[2]").nth(0)).to_have_attribute("class", "cal-event-chip cal-event-chip--medio", timeout=15000), "Middle-day chip (2) uses the class 'cal-event-chip cal-event-chip--medio'."
        # Assert: End-day chip uses the class 'cal-event-chip cal-event-chip--fin'.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[32]/div/div[2]").nth(0)).to_have_attribute("class", "cal-event-chip cal-event-chip--fin", timeout=15000), "End-day chip uses the class 'cal-event-chip cal-event-chip--fin'."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    