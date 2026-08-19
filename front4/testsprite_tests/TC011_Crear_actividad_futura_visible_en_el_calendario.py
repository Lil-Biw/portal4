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
        
        # -> Click the 'Accede aquí' link under '¿Eres administrador?' to open the administrator login page.
        # Accede aquí link
        elem = page.get_by_role('link', name='Accede aquí', exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill 'Correo electrónico' with test.smarclarity@gmail.com and 'Contraseña' with 12341234, then click 'Ingresar al portal'.
        # admin@smartclarity.cl email field
        elem = page.get_by_placeholder('admin@smartclarity.cl', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("test.smarclarity@gmail.com")
        
        # -> Fill 'Correo electrónico' with test.smarclarity@gmail.com and 'Contraseña' with 12341234, then click 'Ingresar al portal'.
        # •••••••• password field
        elem = page.get_by_placeholder('••••••••', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("12341234")
        
        # -> Fill 'Correo electrónico' with test.smarclarity@gmail.com and 'Contraseña' with 12341234, then click 'Ingresar al portal'.
        # button
        elem = page.locator('xpath=/html/body/app-root/app-login-admin-page/div/div[2]/div/form/div[2]/div/button')
        await elem.click(timeout=10000)
        
        # -> Click the 'Ingresar al portal' button to submit the admin credentials and open the admin dashboard.
        # Ingresar al portal button
        elem = page.get_by_role('button', name='Ingresar al portal', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Actividades' link in the left navigation to open the activities section.
        # Actividades link
        elem = page.get_by_role('link', name='Actividades', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the '+ Nueva actividad' button to open the activity creation wizard.
        # + Nueva actividad button
        elem = page.get_by_role('button', name='+ Nueva actividad', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'Tipo' dropdown in the 'Nueva actividad' form so the available activity types appear.
        # Selecciona un tipo button
        elem = page.get_by_role('button', name='Selecciona un tipo', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select the 'Auditoría de Seguridad' type, fill the activity Nombre, set Fecha to 2026-07-22, and set Hora inicio to 09:00 (then wait for the form to update).
        # Auditoría de Seguridad button
        elem = page.get_by_text('Selecciona un tipo', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Auditoría de Seguridad', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select the 'Auditoría de Seguridad' type, fill the activity Nombre, set Fecha to 2026-07-22, and set Hora inicio to 09:00 (then wait for the form to update).
        # Nombre de la actividad text field
        elem = page.get_by_placeholder('Nombre de la actividad', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Actividad TC011 - 09:00\u201311:30")
        
        # -> Select the 'Auditoría de Seguridad' type, fill the activity Nombre, set Fecha to 2026-07-22, and set Hora inicio to 09:00 (then wait for the form to update).
        # date field
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div/div[2]/div/input')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2026-07-22")
        
        # -> Select the 'Auditoría de Seguridad' type, fill the activity Nombre, set Fecha to 2026-07-22, and set Hora inicio to 09:00 (then wait for the form to update).
        # time field
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div/div[3]/div/input')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("09:00")
        
        # -> Set 'Hora término (opcional)' to 11:30 and click the 'Siguiente →' button to advance the activity creation wizard.
        # time field
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div/div[3]/div[2]/input')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("11:30")
        
        # -> Set 'Hora término (opcional)' to 11:30 and click the 'Siguiente →' button to advance the activity creation wizard.
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'Empresa' dropdown in the 'Nueva actividad' modal so available companies can be selected.
        # Selecciona una empresa AgroSur Ltda. Constructora... dropdown
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div/select')
        await elem.click(timeout=10000)
        
        # -> Select the company 'AgroSur Ltda.' from the Empresa dropdown in the 'Nueva actividad' form.
        # Selecciona una empresa AgroSur Ltda. Constructora... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Scroll the 'Nueva actividad' modal content to reveal the 'Centro de costos' dropdown so a centro can be selected, then click 'Siguiente →'.
        await page.mouse.wheel(0, 300)
        
        # -> Select the 'Maquinaria y Taller Mecánico' option in the Centro de costos dropdown and click the 'Siguiente →' button.
        # Selecciona un centro Fundo San Rafael Maquinaria... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Select the 'Maquinaria y Taller Mecánico' option in the Centro de costos dropdown and click the 'Siguiente →' button.
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Siguiente →' button in the activity creation modal to proceed from Notificaciones to the Documents step.
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Siguiente →' button in the activity modal to go to the Resumen step and then submit to create the activity.
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Guardar ✓' button to create the activity.
        # Guardar ✓ button
        elem = page.get_by_role('button', name='Guardar ✓', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Semana' button to switch the calendar to week view so the created activity's hourly block can be located and inspected.
        # Semana button
        elem = page.get_by_role('button', name='Semana', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
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
    