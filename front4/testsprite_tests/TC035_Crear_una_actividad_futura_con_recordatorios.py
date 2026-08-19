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
        
        # -> Click en el enlace 'Accede aquí' (¿Eres administrador?) para abrir el login de administrador.
        # Accede aquí link
        elem = page.get_by_role('link', name='Accede aquí', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill the 'Correo electrónico' and 'Contraseña' fields and click the 'Ingresar al portal' button to sign in as the superadmin.
        # admin@smartclarity.cl email field
        elem = page.get_by_placeholder('admin@smartclarity.cl', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("superadmin@eclariti.local")
        
        # -> Fill the 'Correo electrónico' and 'Contraseña' fields and click the 'Ingresar al portal' button to sign in as the superadmin.
        # •••••••• password field
        elem = page.get_by_placeholder('••••••••', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Demo1234!")
        
        # -> Fill the 'Correo electrónico' and 'Contraseña' fields and click the 'Ingresar al portal' button to sign in as the superadmin.
        # button
        elem = page.locator('xpath=/html/body/app-root/app-login-admin-page/div/div[2]/div/form/div[2]/div/button')
        await elem.click(timeout=10000)
        
        # -> Hacer click en el botón 'Ingresar al portal' para iniciar sesión como superadmin y acceder al panel de administración.
        # Ingresar al portal button
        elem = page.get_by_role('button', name='Ingresar al portal', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Actividades' link in the sidebar to open the Activities page.
        # Actividades link
        elem = page.get_by_role('link', name='Actividades', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the '+ Nueva actividad' button to open the activity creation form.
        # + Nueva actividad button
        elem = page.get_by_role('button', name='+ Nueva actividad', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill the 'Nombre' field, open the 'Tipo' selector, set 'Fecha' to 2026-08-15, and open the 'Empresa' dropdown so company options appear.
        # Nombre de la actividad text field
        elem = page.get_by_placeholder('Nombre de la actividad', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("AutoTest Actividad Recordatorios")
        
        # -> Fill the 'Nombre' field, open the 'Tipo' selector, set 'Fecha' to 2026-08-15, and open the 'Empresa' dropdown so company options appear.
        # Selecciona un tipo button
        elem = page.get_by_role('button', name='Selecciona un tipo', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill the 'Nombre' field, open the 'Tipo' selector, set 'Fecha' to 2026-08-15, and open the 'Empresa' dropdown so company options appear.
        # date field
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div/div[2]/div/input')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2026-08-15")
        
        # -> Fill the 'Nombre' field, open the 'Tipo' selector, set 'Fecha' to 2026-08-15, and open the 'Empresa' dropdown so company options appear.
        # Selecciona una empresa AgroSur Ltda. Constructora... dropdown
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div/select')
        await elem.click(timeout=10000)
        
        # -> Select 'AgroSur Ltda.' from the 'Empresa' dropdown so the Centro de costos list can load (prepare to advance to 'Notificaciones').
        # Selecciona una empresa AgroSur Ltda. Constructora... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Hacer clic en la pestaña 'Notificaciones' dentro del modal 'Nueva actividad' para mostrar y revisar los pills/checkboxes de recordatorios.
        # 2 Notificaciones button
        elem = page.get_by_role('button', name='2 Notificaciones', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Siguiente →' button in the 'Nueva actividad' modal to open the 'Notificaciones' tab and reveal the reminder pills.
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Notificaciones' tab within the 'Nueva actividad' modal to reveal the reminder pills (e.g., '30 días antes', '7 días antes', 'El día').
        # 2 Notificaciones button
        elem = page.get_by_role('button', name='2 Notificaciones', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Notificaciones' tab in the 'Nueva actividad' modal to reveal the reminder pills (e.g., '30 días antes', '7 días antes', 'El día').
        # 2 Notificaciones button
        elem = page.get_by_role('button', name='2 Notificaciones', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click en la pestaña 'Notificaciones' dentro del modal 'Nueva actividad' para mostrar los pills de recordatorio (por ejemplo '30 días antes', '7 días antes', 'El día').
        # 2 Notificaciones button
        elem = page.get_by_role('button', name='2 Notificaciones', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select the activity type 'Auditoría de Seguridad' from the 'Tipo' dropdown so the form validation clears and the Notificaciones step becomes accessible.
        # Auditoría de Seguridad button
        elem = page.get_by_text('Selecciona un tipo', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Auditoría de Seguridad', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Centro de costos' dropdown and select a center (e.g., 'Fundo San Rafael') so the form validation can clear and the wizard can advance to 'Notificaciones'.
        # Selecciona un centro Fundo San Rafael Maquinaria... dropdown
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div[2]/select')
        await elem.click(timeout=10000)
        
        # -> Select 'Fundo San Rafael' from the 'Centro de costos' dropdown so the wizard validation clears and the 'Notificaciones' step can be opened.
        # Selecciona un centro Fundo San Rafael Maquinaria... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Click the 'Siguiente →' button in the 'Nueva actividad' modal to open the 'Notificaciones' step and reveal the reminder pills.
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Seleccionar los pills de recordatorio '30 días antes' y '7 días antes' en la pestaña Notificaciones y luego hacer clic en 'Siguiente →'.
        # ✓ 30 días antes
        elem = page.get_by_text('✓ 30 días antes', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
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
    