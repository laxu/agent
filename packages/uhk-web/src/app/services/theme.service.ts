import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { fromEvent, Observable } from 'rxjs';
import { skipWhile, withLatestFrom } from 'rxjs/operators';
import { LogService, AppTheme } from 'uhk-common';
import { AppState, getAppTheme } from '../store';

const THEME_FILES = {
    DEFAULT: 'stylesLight.css',
    [AppTheme.Light]: 'stylesLight.css',
    [AppTheme.Dark]: 'stylesDark.css'
};

const UHK_THEME_ID = 'uhk-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    appTheme$: Observable<AppTheme>;
    darkModeListener$: Observable<MediaQueryListEvent>;
    darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    constructor(
        @Inject(DOCUMENT) private document: Document,
        private store: Store<AppState>,
        private logService: LogService
    ) {
        this.appTheme$ = this.store.select(getAppTheme);
        this.appTheme$.subscribe(value => this.setTheme(value));
        this.attachListener();

        this.logService.misc('[ThemeService] init success');
    }

    prefersDarkMode(): boolean {
        return this.darkModeMediaQuery.matches;
    }

    setTheme(theme: AppTheme): void {
        let newTheme = theme;
        if (theme === AppTheme.Auto) {
            newTheme = this.prefersDarkMode() ? AppTheme.Dark : AppTheme.Light;
        }
        const currentStylesheetEl = this.getCurrentStylesheetElement();
        const newStylesheetEl = this.createStylesheetElement(newTheme, currentStylesheetEl);

        if (currentStylesheetEl) {
            // Don't try to change already set theme
            if (currentStylesheetEl.getAttribute('data-theme') === newTheme) {
                return;
            }

            // Set new theme
            currentStylesheetEl.after(newStylesheetEl);
        } else {
            // Fallback, insert new theme to end of HEAD element
            this.document.head.appendChild(newStylesheetEl);
        }
    }

    private attachListener(): void {
        this.darkModeListener$ = fromEvent(this.darkModeMediaQuery, 'change') as Observable<MediaQueryListEvent>;
        this.darkModeListener$.pipe(
            withLatestFrom(this.appTheme$),
            skipWhile(([_, theme]) => theme !== AppTheme.Auto)
        ).subscribe(([event]) => {
            this.setTheme(event.matches ? AppTheme.Dark : AppTheme.Light);
        });
    }

    private getCurrentStylesheetElement(): HTMLLinkElement {
        return this.document.head.querySelector(`link[id="${UHK_THEME_ID}"]`);
    }

    private createStylesheetElement(theme: AppTheme, currentThemeEl: HTMLLinkElement): HTMLLinkElement {
        const file = THEME_FILES[theme] || THEME_FILES.DEFAULT;
        const el = this.document.createElement('link');
        el.setAttribute('id', UHK_THEME_ID);
        el.setAttribute('data-theme', theme);
        el.setAttribute('rel', 'stylesheet');
        el.setAttribute('type', 'text/css');
        el.setAttribute('href', `${file}`);

        if (currentThemeEl) {
            el.onload = () => {
                // Remove current theme stylesheet element after new one has loaded
                // This prevents flash of unstyled content
                this.document.head.removeChild(currentThemeEl);
            };
        }

        el.onerror = () => {
            // Remove new theme stylesheet element if it fails to load for some reason
            this.document.head.removeChild(el);
        };
        return el;
    }
}