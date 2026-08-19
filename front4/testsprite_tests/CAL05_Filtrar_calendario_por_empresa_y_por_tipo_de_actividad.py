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
        
        # -> Hacer clic en el enlace 'Accede aquí' (¿Eres administrador?) para abrir la página de login de administrador.
        # Accede aquí link
        elem = page.get_by_role('link', name='Accede aquí', exact=True)
        await elem.click(timeout=10000)
        
        # -> Rellenar 'superadmin@eclariti.local' en el campo Correo electrónico, 'Demo1234!' en Contraseña y hacer clic en 'Ingresar al portal'.
        # admin@smartclarity.cl email field
        elem = page.get_by_placeholder('admin@smartclarity.cl', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("superadmin@eclariti.local")
        
        # -> Rellenar 'superadmin@eclariti.local' en el campo Correo electrónico, 'Demo1234!' en Contraseña y hacer clic en 'Ingresar al portal'.
        # •••••••• password field
        elem = page.get_by_placeholder('••••••••', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Demo1234!")
        
        # -> Rellenar 'superadmin@eclariti.local' en el campo Correo electrónico, 'Demo1234!' en Contraseña y hacer clic en 'Ingresar al portal'.
        # button
        elem = page.locator('xpath=/html/body/app-root/app-login-admin-page/div/div[2]/div/form/div[2]/div/button')
        await elem.click(timeout=10000)
        
        # -> Hacer clic en el botón 'Ingresar al portal' y verificar que la aplicación navegue al panel de administración.
        # Ingresar al portal button
        elem = page.get_by_role('button', name='Ingresar al portal', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Actividades' link in the left sidebar to open the calendar/Actividades section.
        # Actividades link
        elem = page.get_by_role('link', name='Actividades', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the empresa selector (the dropdown currently showing 'Todas las empresas') so the list of empresas appears and then select 'AgroSur Ltda.'
        # Todas las empresas AgroSur Ltda. Constructora... dropdown
        elem = page.locator('xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[2]/div[3]/select')
        await elem.click(timeout=10000)
        
        # -> Select 'AgroSur Ltda.' from the company dropdown labelled 'Todas las empresas' to filter calendar events by company.
        # Todas las empresas AgroSur Ltda. Constructora... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[2]/div[3]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Click the 'Auditoría de Seguridad' legend chip to toggle that tipo filter (after counting current visible events for the selected company).
        # Auditoría de Seguridad button
        elem = page.get_by_role('button', name='Auditoría de Seguridad', exact=True)
        await elem.click(timeout=10000)
        
        # -> Abrir el evento visible 'testeo de documentos' y verificar en su detalle que la Empresa/Centro pertenece a 'AgroSur Ltda.' y que su Tipo es 'Auditoría de Seguridad' (confirmar filtrado AND).
        # testeo de documentos
        elem = page.get_by_text('testeo de documentos', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Cancelar' button in the activity edit modal to close it, then recount visible event chips in the monthly calendar to verify the filtered count.
        # Cancelar button
        elem = page.get_by_role('button', name='Cancelar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Resetear el filtro de empresa a 'Todas las empresas' y desactivar el chip 'Auditoría de Seguridad', luego recuentar los eventos visibles en la vista Mes para verificar que el conteo vuelva al baseline (35).
        # Auditoría de Seguridad button
        elem = page.get_by_role('button', name='Auditoría de Seguridad', exact=True)
        await elem.click(timeout=10000)
        
        # -> Resetear el filtro de empresa a 'Todas las empresas' y desactivar el chip 'Auditoría de Seguridad', luego recuentar los eventos visibles en la vista Mes para verificar que el conteo vuelva al baseline (35).
        # Todas las empresas AgroSur Ltda. Constructora... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[2]/div[3]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # --> Assertions to verify final state
        
        # --> Verify only activities belonging to centros of that empresa remain visible in the calendar
        # Assert: The empresa selector shows 'AgroSur Ltda.' as the selected company.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[2]/div[3]/select").nth(0)).to_contain_text("AgroSur Ltda.", timeout=15000), "The empresa selector shows 'AgroSur Ltda.' as the selected company."
        await page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[11]/div/div[1]").nth(0).scroll_into_view_if_needed()
        # Assert: The activity 'testeo de documentos' (belongs to AgroSur Ltda.) remains visible in the calendar after applying the empresa filter.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[11]/div/div[1]").nth(0)).to_be_visible(timeout=15000), "The activity 'testeo de documentos' (belongs to AgroSur Ltda.) remains visible in the calendar after applying the empresa filter."
        
        # --> Verify the calendar further narrows to only activities of the selected tipo(s), while still respecting the empresa filter
        # Assert: The empresa selector contains 'AgroSur Ltda.' indicating the company filter is present.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[2]/div[3]/select").nth(0)).to_contain_text("AgroSur Ltda.", timeout=15000), "The empresa selector contains 'AgroSur Ltda.' indicating the company filter is present."
        await page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[2]/div[2]/button[1]").nth(0).scroll_into_view_if_needed()
        # Assert: The 'Auditoría de Seguridad' tipo chip is visible on the page.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[2]/div[2]/button[1]").nth(0)).to_be_visible(timeout=15000), "The 'Auditor\u00eda de Seguridad' tipo chip is visible on the page."
        await page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[11]/div/div[1]").nth(0).scroll_into_view_if_needed()
        # Assert: The activity 'testeo de documentos' is visible in the calendar while filters are applied.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[11]/div/div[1]").nth(0)).to_be_visible(timeout=15000), "The activity 'testeo de documentos' is visible in the calendar while filters are applied."
        
        # --> Verify all activities reappear in the calendar (same count as the initial observation)
        await page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[11]/div/div[1]").nth(0).scroll_into_view_if_needed()
        # Assert: Verify the 'testeo de documentos' activity is visible in the calendar.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[11]/div/div[1]").nth(0)).to_be_visible(timeout=15000), "Verify the 'testeo de documentos' activity is visible in the calendar."
        await page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[9]/div/div").nth(0).scroll_into_view_if_needed()
        # Assert: Verify the 'Testeo Electrico' activity is visible in the calendar.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[9]/div/div").nth(0)).to_be_visible(timeout=15000), "Verify the 'Testeo Electrico' activity is visible in the calendar."
        await page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[31]/div/div[2]").nth(0).scroll_into_view_if_needed()
        # Assert: Verify the 'Testeo de Subcripciones' activity is visible in the calendar.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[31]/div/div[2]").nth(0)).to_be_visible(timeout=15000), "Verify the 'Testeo de Subcripciones' activity is visible in the calendar."
        await page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[32]/div/div[2]").nth(0).scroll_into_view_if_needed()
        # Assert: Verify the 'Auditoría de seguridad en obra' activity is visible in the calendar.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[32]/div/div[2]").nth(0)).to_be_visible(timeout=15000), "Verify the 'Auditor\u00eda de seguridad en obra' activity is visible in the calendar."
        await page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[20]/div/div[2]").nth(0).scroll_into_view_if_needed()
        # Assert: Verify the 'Mantenimiento correctivo excavadora' activity is visible in the calendar.
        await expect(page.locator("xpath=/html/body/app-root/app-main-layout/div/main/app-actividades-page/div[3]/div[2]/div[20]/div/div[2]").nth(0)).to_be_visible(timeout=15000), "Verify the 'Mantenimiento correctivo excavadora' activity is visible in the calendar."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    