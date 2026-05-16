// Copyright 2024 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {CrLitElement} from 'chrome://resources/lit/v3_0/lit.rollup.js';

import {getCss} from './app.css.js';
import {getHtml} from './app.html.js';
// Delay Mojo imports to avoid initialization issues
// import {BrowserProxy} from './browser_proxy.js';
// import type {SearchEngine as MojoSearchEngine, RecentTab as MojoRecentTab} from './neurobrowser_ntp.mojom-webui.js';

export interface SearchEngine {
  name: string;
  keyword: string;
  url: string;
  faviconUrl: string;
  isDefault: boolean;
}

export interface RecentTab {
  title: string;
  url: string;
  faviconUrl: string;
}

// Default search engines to show when mojo fails
const DEFAULT_SEARCH_ENGINES: SearchEngine[] = [
  {
    name: 'Google',
    keyword: '@google',
    url: 'https://www.google.com/search?q={searchTerms}',
    faviconUrl: 'https://www.google.com/favicon.ico',
    isDefault: true,
  },
  {
    name: 'Bing',
    keyword: '@bing',
    url: 'https://www.bing.com/search?q={searchTerms}',
    faviconUrl: 'https://www.bing.com/favicon.ico',
    isDefault: false,
  },
  {
    name: 'DuckDuckGo',
    keyword: '@duckduckgo',
    url: 'https://duckduckgo.com/?q={searchTerms}',
    faviconUrl: 'https://duckduckgo.com/favicon.ico',
    isDefault: false,
  },
  {
    name: 'Yahoo',
    keyword: '@yahoo',
    url: 'https://search.yahoo.com/search?p={searchTerms}',
    faviconUrl: 'https://www.yahoo.com/favicon.ico',
    isDefault: false,
  },
];

export class NeuroBrowserNtpAppElement extends CrLitElement {
  static get is() {
    return 'neurobrowser-ntp-app';
  }

  static override get styles() {
    return getCss();
  }

  override render() {
    return getHtml.bind(this)();
  }

  static override get properties() {
    return {
      searchEngines_: {type: Array},
      selectedSearchEngine_: {type: Object},
      recentTabs_: {type: Array},
      dropdownOpen_: {type: Boolean},
    };
  }

  protected accessor searchEngines_: SearchEngine[] = DEFAULT_SEARCH_ENGINES;
  protected accessor selectedSearchEngine_: SearchEngine|null = 
      DEFAULT_SEARCH_ENGINES.length > 0 ? DEFAULT_SEARCH_ENGINES[0]! : null;
  protected accessor recentTabs_: RecentTab[] = [];
  protected accessor dropdownOpen_: boolean = false;

  // Mojo disabled for testing
  // private browserProxy_: BrowserProxy|null = null;

  // private getBrowserProxy_(): BrowserProxy {
  //   if (!this.browserProxy_) {
  //     this.browserProxy_ = BrowserProxy.getInstance();
  //   }
  //   return this.browserProxy_;
  // }

  override connectedCallback() {
    super.connectedCallback();
    // Skip Mojo initialization for now
    // this.initializeData_();
    
    // Close dropdown when clicking outside
    document.addEventListener('click', this.closeDropdownOnOutsideClick_.bind(this));
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this.closeDropdownOnOutsideClick_.bind(this));
  }

  // Mojo-based data loading - disabled for testing
  /*
  private async initializeData_() {
    try {
      const proxy = this.getBrowserProxy_();
      // Get search engines from the handler
      const {searchEngines} = await proxy.handler.getSearchEngines();
      if (searchEngines && searchEngines.length > 0) {
        this.searchEngines_ = searchEngines.map((engine: MojoSearchEngine) => ({
          name: engine.name,
          keyword: engine.keyword,
          url: engine.url,
          faviconUrl: engine.faviconUrl || `chrome://favicon/${engine.url}`,
          isDefault: engine.isDefault,
        }));
        
        // Set selected engine to the default one
        const defaultEngine = this.searchEngines_.find(e => e.isDefault);
        if (defaultEngine) {
          this.selectedSearchEngine_ = defaultEngine;
        } else if (this.searchEngines_.length > 0) {
          this.selectedSearchEngine_ = this.searchEngines_[0]!;
        }
      }

      // Get recent tabs
      const {recentTabs} = await proxy.handler.getRecentTabs();
      if (recentTabs && recentTabs.length > 0) {
        this.recentTabs_ = recentTabs.map((tab: MojoRecentTab) => ({
          title: tab.title,
          url: tab.url,
          faviconUrl: tab.faviconUrl || `chrome://favicon/${tab.url}`,
        }));
      }

      // Listen for search engine updates
      proxy.callbackRouter.onSearchEnginesChanged.addListener(
        (engines: MojoSearchEngine[]) => {
          this.searchEngines_ = engines.map((engine: MojoSearchEngine) => ({
            name: engine.name,
            keyword: engine.keyword,
            url: engine.url,
            faviconUrl: engine.faviconUrl || `chrome://favicon/${engine.url}`,
            isDefault: engine.isDefault,
          }));
          
          const defaultEngine = this.searchEngines_.find(e => e.isDefault);
          if (defaultEngine) {
            this.selectedSearchEngine_ = defaultEngine;
          }
        }
      );
    } catch (e) {
      console.warn('NeuroBrowser NTP: Failed to initialize data from handler, using defaults', e);
      // Keep using default search engines
    }
  }
  */

  protected toggleDropdown_() {
    this.dropdownOpen_ = !this.dropdownOpen_;
  }

  protected stopPropagation_(e: Event) {
    e.stopPropagation();
  }

  private closeDropdownOnOutsideClick_(e: Event) {
    const dropdown = this.shadowRoot?.querySelector('.dropdown');
    if (dropdown && !dropdown.contains(e.target as Node)) {
      this.dropdownOpen_ = false;
    }
  }

  protected selectSearchEngine_(engine: SearchEngine) {
    this.selectedSearchEngine_ = engine;
    this.dropdownOpen_ = false;
    
    // Mark the selected engine as default in the array
    this.searchEngines_ = this.searchEngines_.map(e => ({
      ...e,
      isDefault: e.keyword === engine.keyword,
    }));

    // Mojo disabled for testing
    // Notify the handler about the selection
    // try {
    //   this.getBrowserProxy_().handler.setDefaultSearchEngine(engine.keyword);
    // } catch (e) {
    //   console.warn('NeuroBrowser NTP: Failed to set default search engine', e);
    // }
  }

  protected onSearchKeydown_(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      const input = e.target as HTMLInputElement;
      const query = input.value.trim();
      if (query) {
        this.performSearch_(query);
      }
    }
  }

  private performSearch_(query: string) {
    if (!this.selectedSearchEngine_) {
      return;
    }

    // Check if it's a URL
    if (this.isUrl_(query)) {
      let url = query;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      window.location.href = url;
      return;
    }

    // Perform search using the selected engine
    const searchUrl = this.selectedSearchEngine_.url.replace(
      '{searchTerms}',
      encodeURIComponent(query)
    );
    window.location.href = searchUrl;
  }

  private isUrl_(str: string): boolean {
    // Simple URL detection
    const urlPattern = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i;
    return urlPattern.test(str);
  }

  protected openRecentTab_(tab: RecentTab) {
    window.location.href = tab.url;
  }

  protected onFaviconError_(e: Event) {
    const img = e.target as HTMLImageElement;
    // Set a default search icon on error
    img.style.display = 'none';
  }

  protected onRecentTabFaviconError_(e: Event) {
    const img = e.target as HTMLImageElement;
    // Set a default icon on error
    img.src = 'chrome://theme/IDR_DEFAULT_FAVICON';
  }
}

customElements.define(NeuroBrowserNtpAppElement.is, NeuroBrowserNtpAppElement);
