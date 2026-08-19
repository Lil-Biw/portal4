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
        
        # -> Click the 'Accede aquí' link to open the administrator login page.
        # Accede aquí link
        elem = page.get_by_role('link', name='Accede aquí', exact=True)
        await elem.click(timeout=10000)
        
        # -> Rellenar 'Correo electrónico' con superadmin@eclariti.local y 'Contraseña' con Demo1234!, luego hacer clic en el botón 'Ingresar al portal'.
        # admin@smartclarity.cl email field
        elem = page.get_by_placeholder('admin@smartclarity.cl', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("superadmin@eclariti.local")
        
        # -> Rellenar 'Correo electrónico' con superadmin@eclariti.local y 'Contraseña' con Demo1234!, luego hacer clic en el botón 'Ingresar al portal'.
        # •••••••• password field
        elem = page.get_by_placeholder('••••••••', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Demo1234!")
        
        # -> Rellenar 'Correo electrónico' con superadmin@eclariti.local y 'Contraseña' con Demo1234!, luego hacer clic en el botón 'Ingresar al portal'.
        # button
        elem = page.locator('xpath=/html/body/app-root/app-login-admin-page/div/div[2]/div/form/div[2]/div/button')
        await elem.click(timeout=10000)
        
        # -> Click the 'Ingresar al portal' button to submit the admin login form.
        # Ingresar al portal button
        elem = page.get_by_role('button', name='Ingresar al portal', exact=True)
        await elem.click(timeout=10000)
        
        # -> Abrir la sección 'Actividades' desde el menú izquierdo (click en el enlace 'Actividades').
        # Actividades link
        elem = page.get_by_role('link', name='Actividades', exact=True)
        await elem.click(timeout=10000)
        
        # -> Hacer clic en el botón '+ Nueva actividad' para abrir el formulario de creación de actividad.
        # + Nueva actividad button
        elem = page.get_by_role('button', name='+ Nueva actividad', exact=True)
        await elem.click(timeout=10000)
        
        # -> Rellenar 'Nombre' con 'Test Reminders Activity TC051', fijar 'Fecha' a 2026-07-25 y abrir el desplegable 'Empresa'.
        # Nombre de la actividad text field
        elem = page.get_by_placeholder('Nombre de la actividad', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Test Reminders Activity TC051")
        
        # -> Rellenar 'Nombre' con 'Test Reminders Activity TC051', fijar 'Fecha' a 2026-07-25 y abrir el desplegable 'Empresa'.
        # date field
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div/div[2]/div/input')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2026-07-25")
        
        # -> Rellenar 'Nombre' con 'Test Reminders Activity TC051', fijar 'Fecha' a 2026-07-25 y abrir el desplegable 'Empresa'.
        # Selecciona una empresa AgroSur Ltda. Constructora... dropdown
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div/select')
        await elem.click(timeout=10000)
        
        # -> Select 'AgroSur Ltda.' from the Empresa dropdown in the 'Nueva actividad' form.
        # Selecciona una empresa AgroSur Ltda. Constructora... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Seleccionar 'Fundo San Rafael' en el desplegable 'Centro de costos'.
        # Selecciona un centro Fundo San Rafael Maquinaria... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Click the 'Siguiente →' button to open the 'Notificaciones' tab.
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'Tipo' dropdown (the control labeled 'Selecciona un tipo') so an activity type can be selected.
        # Selecciona un tipo button
        elem = page.get_by_role('button', name='Selecciona un tipo', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Inspección' option in the 'Tipo' dropdown to select that activity type.
        # Inspección button
        elem = page.get_by_text('Selecciona un tipo', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Inspección', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Siguiente →' button to open the 'Notificaciones' tab in the 'Nueva actividad' modal.
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Deselect '15 días antes', '3 días antes', '1 día antes' and 'El día de la actividad' so only '30 días antes' and '7 días antes' remain selected, then click the 'Siguiente →' button.
        # ✓ 15 días antes
        elem = page.get_by_text('✓ 15 días antes', exact=True)
        await elem.click(timeout=10000)
        
        # -> Deselect '15 días antes', '3 días antes', '1 día antes' and 'El día de la actividad' so only '30 días antes' and '7 días antes' remain selected, then click the 'Siguiente →' button.
        # ✓ 3 días antes
        elem = page.get_by_text('✓ 3 días antes', exact=True)
        await elem.click(timeout=10000)
        
        # -> Deselect '15 días antes', '3 días antes', '1 día antes' and 'El día de la actividad' so only '30 días antes' and '7 días antes' remain selected, then click the 'Siguiente →' button.
        # ✓ 1 día antes
        elem = page.get_by_text('✓ 1 día antes', exact=True)
        await elem.click(timeout=10000)
        
        # -> Deselect '15 días antes', '3 días antes', '1 día antes' and 'El día de la actividad' so only '30 días antes' and '7 días antes' remain selected, then click the 'Siguiente →' button.
        # ✓ El día de la actividad
        elem = page.get_by_text('✓ El día de la actividad', exact=True)
        await elem.click(timeout=10000)
        
        # -> Deselect '15 días antes', '3 días antes', '1 día antes' and 'El día de la actividad' so only '30 días antes' and '7 días antes' remain selected, then click the 'Siguiente →' button.
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Siguiente →' button to open the 'Resumen' step and proceed to create the activity.
        # Siguiente → button
        elem = page.get_by_role('button', name='Siguiente →', exact=True)
        await elem.click(timeout=10000)
        
        # -> Hacer clic en el botón 'Guardar ✓' para crear la actividad desde el modal de Resumen.
        # Guardar ✓ button
        elem = page.get_by_role('button', name='Guardar ✓', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the activity 'Test Reminders Activity TC051' from the calendar to view/edit its details and check the reminder pills.
        # Test Reminders Activity TC051
        elem = page.get_by_text('Test Reminders Activity TC051', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Notificaciones' tab inside the activity edit modal to view the reminder pills.
        # 2 Notificaciones button
        elem = page.get_by_role('button', name='2 Notificaciones', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the activity details reflect the updated schedule
        # Assert: The activity details show the '30 días antes' reminder.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/label[1]").nth(0)).to_contain_text("30 d\u00edas antes", timeout=15000), "The activity details show the '30 d\u00edas antes' reminder."
        # Assert: The activity details show the '7 días antes' reminder.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[2]/div/div[2]/div/label[3]").nth(0)).to_contain_text("7 d\u00edas antes", timeout=15000), "The activity details show the '7 d\u00edas antes' reminder."
        # Assert: The activity header indicates there are 2 notifications (reminders).
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[4]/div/div[1]/div[2]/button[2]").nth(0)).to_have_text("2 \nNotificaciones", timeout=15000), "The activity header indicates there are 2 notifications (reminders)."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    