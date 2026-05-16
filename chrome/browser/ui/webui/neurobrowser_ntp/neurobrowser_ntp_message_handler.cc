// Copyright 2024 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/webui/neurobrowser_ntp/neurobrowser_ntp_message_handler.h"

#include "base/functional/bind.h"
#include "base/strings/utf_string_conversions.h"
#include "base/values.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/search_engines/template_url_service_factory.h"
#include "components/search_engines/template_url.h"
#include "components/search_engines/template_url_service.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_ui.h"
#include "url/gurl.h"

NeuroBrowserNtpMessageHandler::NeuroBrowserNtpMessageHandler(Profile* profile)
    : profile_(profile),
      template_url_service_(TemplateURLServiceFactory::GetForProfile(profile)) {
}

NeuroBrowserNtpMessageHandler::~NeuroBrowserNtpMessageHandler() {
  if (template_url_service_) {
    template_url_service_->RemoveObserver(this);
  }
}

void NeuroBrowserNtpMessageHandler::RegisterMessages() {
  web_ui()->RegisterMessageCallback(
      "getSearchEngines",
      base::BindRepeating(
          &NeuroBrowserNtpMessageHandler::HandleGetSearchEngines,
          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "setDefaultSearchEngine",
      base::BindRepeating(
          &NeuroBrowserNtpMessageHandler::HandleSetDefaultSearchEngine,
          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "performSearch",
      base::BindRepeating(&NeuroBrowserNtpMessageHandler::HandlePerformSearch,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "openUrl",
      base::BindRepeating(&NeuroBrowserNtpMessageHandler::HandleOpenUrl,
                          base::Unretained(this)));
}

void NeuroBrowserNtpMessageHandler::OnJavascriptAllowed() {
  if (template_url_service_) {
    template_url_service_->AddObserver(this);
  }
}

void NeuroBrowserNtpMessageHandler::OnJavascriptDisallowed() {
  if (template_url_service_) {
    template_url_service_->RemoveObserver(this);
  }
}

void NeuroBrowserNtpMessageHandler::OnTemplateURLServiceChanged() {
  SendSearchEngines();
}

void NeuroBrowserNtpMessageHandler::HandleGetSearchEngines(
    const base::Value::List& args) {
  AllowJavascript();

  // Send the search engines list back to JS via a global callback
  SendSearchEngines();
}

void NeuroBrowserNtpMessageHandler::HandleSetDefaultSearchEngine(
    const base::Value::List& args) {
  if (!template_url_service_ || args.size() < 1 || !args[0].is_string()) {
    return;
  }

  const std::string& engine_keyword = args[0].GetString();

  // Try to find the search engine by keyword first
  TemplateURL* template_url = template_url_service_->GetTemplateURLForKeyword(
      base::UTF8ToUTF16(engine_keyword));

  // If not found by keyword, search by checking if the URL contains the domain
  if (!template_url) {
    for (TemplateURL* turl : template_url_service_->GetTemplateURLs()) {
      std::string url = turl->url();
      // Check if the template URL contains the engine keyword (e.g.,
      // "google.com")
      if (url.find(engine_keyword) != std::string::npos) {
        template_url = turl;
        break;
      }
    }
  }

  if (template_url) {
    template_url_service_->SetUserSelectedDefaultSearchProvider(template_url);
  }
}

void NeuroBrowserNtpMessageHandler::HandlePerformSearch(
    const base::Value::List& args) {
  if (!template_url_service_ || args.size() < 1) {
    return;
  }

  const std::string& query = args[0].GetString();

  const TemplateURL* default_provider =
      template_url_service_->GetDefaultSearchProvider();
  if (!default_provider) {
    return;
  }

  TemplateURLRef::SearchTermsArgs search_terms_args(base::UTF8ToUTF16(query));
  GURL search_url(default_provider->url_ref().ReplaceSearchTerms(
      search_terms_args, template_url_service_->search_terms_data()));

  if (search_url.is_valid() && web_ui()->GetWebContents()) {
    content::NavigationController::LoadURLParams params(search_url);
    params.transition_type = ui::PAGE_TRANSITION_GENERATED;
    web_ui()->GetWebContents()->GetController().LoadURLWithParams(params);
  }
}

void NeuroBrowserNtpMessageHandler::HandleOpenUrl(
    const base::Value::List& args) {
  if (args.size() < 1) {
    return;
  }

  const std::string& url_string = args[0].GetString();
  GURL url(url_string);

  if (url.is_valid() && web_ui()->GetWebContents()) {
    content::NavigationController::LoadURLParams params(url);
    params.transition_type = ui::PAGE_TRANSITION_LINK;
    web_ui()->GetWebContents()->GetController().LoadURLWithParams(params);
  }
}

void NeuroBrowserNtpMessageHandler::SendSearchEngines() {
  if (!IsJavascriptAllowed()) {
    return;
  }
  // Call a global JS function with the search engines list
  FireWebUIListener("searchEnginesReceived", GetSearchEnginesList());
}

base::Value::List NeuroBrowserNtpMessageHandler::GetSearchEnginesList() {
  base::Value::List search_engines;

  if (!template_url_service_) {
    return search_engines;
  }

  const TemplateURL* default_search_provider =
      template_url_service_->GetDefaultSearchProvider();

  TemplateURLService::TemplateURLVector template_urls =
      template_url_service_->GetTemplateURLs();

  for (const TemplateURL* template_url : template_urls) {
    // Skip non-search engines or extension-based ones.
    if (!template_url->url_ref().IsValid(
            template_url_service_->search_terms_data()) ||
        template_url->type() == TemplateURL::OMNIBOX_API_EXTENSION) {
      continue;
    }

    base::Value::Dict engine;
    engine.Set("name", base::UTF16ToUTF8(template_url->short_name()));
    engine.Set("keyword", base::UTF16ToUTF8(template_url->keyword()));
    engine.Set("url", template_url->url());
    engine.Set("isDefault", template_url == default_search_provider);

    // Get favicon URL
    GURL favicon_url = template_url->favicon_url();
    if (favicon_url.is_valid()) {
      engine.Set("faviconUrl", favicon_url.spec());
    } else {
      // Use chrome://favicon as fallback
      GURL search_url(template_url->url());
      if (search_url.is_valid()) {
        engine.Set("faviconUrl", "chrome://favicon/size/32@1x/" +
                                     search_url.GetWithEmptyPath().spec());
      } else {
        engine.Set("faviconUrl", "");
      }
    }

    search_engines.Append(std::move(engine));
  }

  return search_engines;
}
