// Copyright 2024 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/webui/neurobrowser_ntp/neurobrowser_ntp_handler.h"

#include <string>
#include <vector>

#include "base/strings/utf_string_conversions.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/search_engines/template_url_service_factory.h"
#include "chrome/browser/sessions/tab_restore_service_factory.h"
#include "components/favicon/content/content_favicon_driver.h"
#include "components/search_engines/template_url.h"
#include "components/search_engines/template_url_service.h"
#include "components/sessions/core/tab_restore_service.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/web_contents.h"
#include "url/gurl.h"

NeuroBrowserNtpHandler::NeuroBrowserNtpHandler(
    mojo::PendingReceiver<neurobrowser_ntp::mojom::PageHandler>
        pending_page_handler,
    mojo::PendingRemote<neurobrowser_ntp::mojom::Page> pending_page,
    Profile* profile,
    content::WebContents* web_contents)
    : profile_(profile),
      web_contents_(web_contents),
      template_url_service_(
          TemplateURLServiceFactory::GetForProfile(profile)),
      page_(std::move(pending_page)),
      receiver_(this, std::move(pending_page_handler)) {
  if (template_url_service_) {
    template_url_service_->AddObserver(this);
  }
}

NeuroBrowserNtpHandler::~NeuroBrowserNtpHandler() {
  if (template_url_service_) {
    template_url_service_->RemoveObserver(this);
  }
}

void NeuroBrowserNtpHandler::GetSearchEngines(
    GetSearchEnginesCallback callback) {
  std::move(callback).Run(GetSearchEnginesList());
}

void NeuroBrowserNtpHandler::SetDefaultSearchEngine(
    const std::string& keyword) {
  if (!template_url_service_) {
    return;
  }

  TemplateURL* template_url =
      template_url_service_->GetTemplateURLForKeyword(
          base::UTF8ToUTF16(keyword));
  if (template_url) {
    template_url_service_->SetUserSelectedDefaultSearchProvider(template_url);
  }
}

void NeuroBrowserNtpHandler::GetRecentTabs(GetRecentTabsCallback callback) {
  std::vector<neurobrowser_ntp::mojom::RecentTabPtr> recent_tabs;

  sessions::TabRestoreService* tab_restore_service =
      TabRestoreServiceFactory::GetForProfile(profile_);

  if (tab_restore_service) {
    int count = 0;
    const int kMaxRecentTabs = 5;

    for (const auto& entry : tab_restore_service->entries()) {
      if (count >= kMaxRecentTabs) {
        break;
      }

      if (entry->type == sessions::tab_restore::Type::TAB) {
        const auto* tab =
            static_cast<const sessions::tab_restore::Tab*>(entry.get());
        if (!tab->navigations.empty()) {
          const sessions::SerializedNavigationEntry& navigation =
              tab->navigations[tab->current_navigation_index];

          auto recent_tab = neurobrowser_ntp::mojom::RecentTab::New();
          recent_tab->title = base::UTF16ToUTF8(navigation.title());
          recent_tab->url = navigation.virtual_url().spec();
          recent_tab->favicon_url =
              "chrome://favicon/size/32@1x/" + navigation.virtual_url().spec();

          recent_tabs.push_back(std::move(recent_tab));
          count++;
        }
      }
    }
  }

  std::move(callback).Run(std::move(recent_tabs));
}

void NeuroBrowserNtpHandler::OpenUrl(const std::string& url) {
  GURL gurl(url);
  if (gurl.is_valid() && web_contents_) {
    content::NavigationController::LoadURLParams params(gurl);
    params.transition_type = ui::PAGE_TRANSITION_LINK;
    web_contents_->GetController().LoadURLWithParams(params);
  }
}

void NeuroBrowserNtpHandler::PerformSearch(const std::string& query) {
  if (!template_url_service_) {
    return;
  }

  const TemplateURL* default_provider =
      template_url_service_->GetDefaultSearchProvider();
  if (!default_provider) {
    return;
  }

  TemplateURLRef::SearchTermsArgs search_terms_args(base::UTF8ToUTF16(query));
  GURL search_url(default_provider->url_ref().ReplaceSearchTerms(
      search_terms_args, template_url_service_->search_terms_data()));

  if (search_url.is_valid() && web_contents_) {
    content::NavigationController::LoadURLParams params(search_url);
    params.transition_type = ui::PAGE_TRANSITION_GENERATED;
    web_contents_->GetController().LoadURLWithParams(params);
  }
}

void NeuroBrowserNtpHandler::OnTemplateURLServiceChanged() {
  NotifySearchEnginesChanged();
}

void NeuroBrowserNtpHandler::NotifySearchEnginesChanged() {
  page_->OnSearchEnginesChanged(GetSearchEnginesList());
}

std::vector<neurobrowser_ntp::mojom::SearchEnginePtr>
NeuroBrowserNtpHandler::GetSearchEnginesList() {
  std::vector<neurobrowser_ntp::mojom::SearchEnginePtr> search_engines;

  if (!template_url_service_) {
    return search_engines;
  }

  const TemplateURL* default_search_provider =
      template_url_service_->GetDefaultSearchProvider();

  TemplateURLService::TemplateURLVector template_urls =
      template_url_service_->GetTemplateURLs();

  for (const TemplateURL* template_url : template_urls) {
    // Skip non-search engines or hidden ones.
    if (!template_url->url_ref().IsValid(
            template_url_service_->search_terms_data()) ||
        template_url->type() == TemplateURL::OMNIBOX_API_EXTENSION) {
      continue;
    }

    auto engine = neurobrowser_ntp::mojom::SearchEngine::New();
    engine->name = base::UTF16ToUTF8(template_url->short_name());
    engine->keyword = base::UTF16ToUTF8(template_url->keyword());
    engine->url = template_url->url();
    engine->is_default = (template_url == default_search_provider);

    // Get favicon URL
    GURL favicon_url = template_url->favicon_url();
    if (favicon_url.is_valid()) {
      engine->favicon_url = favicon_url.spec();
    } else {
      // Use chrome://favicon as fallback
      GURL search_url(template_url->url());
      if (search_url.is_valid()) {
        engine->favicon_url =
            "chrome://favicon/size/32@1x/" + search_url.GetWithEmptyPath().spec();
      }
    }

    search_engines.push_back(std::move(engine));
  }

  return search_engines;
}
