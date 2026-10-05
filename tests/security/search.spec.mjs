import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const original = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

async function open(page, { title, category } = {}) {
  let html = original;
  if (title) html = html.replace(/(<h3 class="card-title">)[\s\S]*?(<\/h3>)/, (_, start, end) => start + escape(title) + end);
  if (category) html = html.replace('data-category="ia"', `data-category="${escape(category)}"`);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
  await page.goto('http://127.0.0.1:4317/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('#searchInput')).toBeFocused();
  return errors;
}

test('busca normal preserva titulo, categoria, classes e dimensoes', async ({ page }, info) => {
  const errors = await open(page);
  await page.locator('#searchInput').fill(' cLaUdE 4 ');
  const result = page.locator('.search-result-item');
  await expect(result).toHaveCount(1);
  await expect(result.locator('.sr-title')).toHaveText('Claude 4 Opus destr\u00f3i benchmarks \u2014 o que muda pra devs');
  await expect(result.locator('.sr-cat')).toHaveText('[IA]');
  await expect(result.locator('.sr-cat')).toHaveClass('sr-cat cat-ia');
  const bounds = await result.boundingBox();
  expect(bounds.width).toBeGreaterThan(250);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  await page.screenshot({ path: info.outputPath('search-normal.png') });
  expect(errors).toEqual([]);
});

test('titulo com markup e evento permanece texto literal, sem elementos executaveis', async ({ page }) => {
  const title = 'Fixture <img src=x onerror="window.injected=true"> & <svg onload="window.injected=true">';
  const errors = await open(page, { title });
  await page.locator('#searchInput').fill('fixture');
  await expect(page.locator('.sr-title')).toHaveText(title);
  await expect(page.locator('#searchResults img, #searchResults svg, #searchResults script')).toHaveCount(0);
  expect(await page.evaluate(() => Boolean(window.injected))).toBe(false);
  expect(errors).toEqual([]);
});

test('categoria com aspas e markup nao injeta atributos, classes ou elementos', async ({ page }) => {
  const category = 'ia"><img src=x onerror="window.injected=true">';
  const errors = await open(page, { title: 'Fixture categoria', category });
  await page.locator('#searchInput').fill('fixture');
  await expect(page.locator('.sr-cat')).toHaveText(`[${category.toUpperCase()}]`);
  await expect(page.locator('.sr-cat')).toHaveClass('sr-cat');
  await expect(page.locator('#searchResults img, #searchResults [onerror]')).toHaveCount(0);
  expect(await page.evaluate(() => Boolean(window.injected))).toBe(false);
  expect(errors).toEqual([]);
});

test('sem resultados, entrada vazia e Escape limpam apenas a busca', async ({ page }) => {
  const errors = await open(page);
  await page.locator('#searchInput').fill('no-fixture-results');
  await expect(page.locator('#searchResults')).toHaveText('Nenhum resultado encontrado.');
  await page.locator('#searchInput').fill('   ');
  await expect(page.locator('#searchResults')).toBeEmpty();
  await page.locator('#searchInput').fill('claude 4');
  await expect(page.locator('.search-result-item')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#searchOverlay')).not.toBeVisible();
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('#searchInput')).toHaveValue('');
  await expect(page.locator('#searchResults')).toBeEmpty();
  expect(errors).toEqual([]);
});

test('busca e filtro de categoria continuam independentes', async ({ page }) => {
  const errors = await open(page);
  await page.keyboard.press('Escape');
  await page.locator('.filter-tab[data-filter="finance"]').click();
  await expect(page.locator('.news-card:not(.hidden)')).toHaveCount(2);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.locator('#searchInput').fill('claude 4');
  await expect(page.locator('.search-result-item')).toHaveCount(1);
  await expect(page.locator('.news-card:not(.hidden)')).toHaveCount(2);
  expect(errors).toEqual([]);
});
