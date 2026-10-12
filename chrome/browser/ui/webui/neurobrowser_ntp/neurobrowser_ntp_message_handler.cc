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
#include "base/json/json_writer.h"
#include "url/gurl.h"
#include "extensions/browser/extension_registry.h"
#include "extensions/browser/api/storage/storage_frontend.h"
#include "extensions/browser/api/storage/storage_area_namespace.h"
#include "chrome/common/extensions/extension_constants.h"
#include "extensions/common/extension.h"
#include "content/public/browser/storage_partition.h"
#include "services/network/public/cpp/simple_url_loader.h"
#include "services/network/public/cpp/resource_request.h"
#include "services/network/public/mojom/url_response_head.mojom.h"
#include "net/http/http_request_headers.h"
#include "net/traffic_annotation/network_traffic_annotation.h"
#include "net/traffic_annotation/network_traffic_annotation_test_helper.h"
#include "base/task/sequenced_task_runner.h"
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
  web_ui()->RegisterMessageCallback(
      "getAccessToken",
      base::BindRepeating(&NeuroBrowserNtpMessageHandler::HandleGetAccessToken,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "getAvailableModels",
      base::BindRepeating(&NeuroBrowserNtpMessageHandler::HandleGetAvailableModels,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "sendAiMessage",
      base::BindRepeating(&NeuroBrowserNtpMessageHandler::HandleSendAiMessage,
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
    const base::ListValue& args) {
  AllowJavascript();

  // Send the search engines list back to JS via a global callback
  SendSearchEngines();
}

void NeuroBrowserNtpMessageHandler::HandleSetDefaultSearchEngine(
    const base::ListValue& args) {
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
    const base::ListValue& args) {
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
    const base::ListValue& args) {
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

void NeuroBrowserNtpMessageHandler::HandleGetAccessToken(
    const base::ListValue& args) {
  AllowJavascript();

  if (args.size() < 1 || !args[0].is_string()) {
    return;
  }
  std::string callback_id = args[0].GetString();

  extensions::ExtensionRegistry* registry =
      extensions::ExtensionRegistry::Get(profile_);
  if (!registry) {
    ResolveJavascriptCallback(base::Value(callback_id), base::Value(""));
    return;
  }

  const extensions::Extension* extension =
      registry->enabled_extensions().GetByID(
          extension_misc::kNeuroauthExtensionId);

  // Fallback: If exact ID is not found (e.g. developer loaded unpacked with different ID),
  // search by extension name
  if (!extension) {
    for (const auto& enabled_ext : registry->enabled_extensions()) {
      if (enabled_ext->name().find("NeuroAuth") != std::string::npos ||
          enabled_ext->name().find("Neuroauth") != std::string::npos ||
          enabled_ext->name().find("neuroauth") != std::string::npos) {
        extension = enabled_ext.get();
        break;
      }
    }
  }

  if (!extension) {
    ResolveJavascriptCallback(base::Value(callback_id), base::Value(""));
    return;
  }

  extensions::StorageFrontend* storage_frontend =
      extensions::StorageFrontend::Get(profile_);
  if (!storage_frontend) {
    ResolveJavascriptCallback(base::Value(callback_id), base::Value(""));
    return;
  }

  storage_frontend->GetValues(
      extension, extensions::StorageAreaNamespace::kLocal,
      std::vector<std::string>{"access_token"},
      base::BindOnce(
          [](base::WeakPtr<NeuroBrowserNtpMessageHandler> handler,
             const std::string& callback_id,
             extensions::StorageFrontend::GetResult result) {
            bool success = result.status.success;
            std::string token = "";
            if (success && result.data.has_value()) {
              const std::string* token_ptr =
                  result.data->FindString("access_token");
              if (token_ptr) {
                token = *token_ptr;
              }
            }
            if (handler) {
              handler->OnGetAccessToken(callback_id, success, token);
            }
          },
          weak_ptr_factory_.GetWeakPtr(), callback_id));
}

void NeuroBrowserNtpMessageHandler::OnGetAccessToken(
    const std::string& callback_id,
    bool success,
    const std::string& token) {
  if (IsJavascriptAllowed()) {
    ResolveJavascriptCallback(base::Value(callback_id), base::Value(token));
  }
}

void NeuroBrowserNtpMessageHandler::SendSearchEngines() {
  if (!IsJavascriptAllowed()) {
    return;
  }
  // Call a global JS function with the search engines list
  FireWebUIListener("searchEnginesReceived", GetSearchEnginesList());
}

base::ListValue NeuroBrowserNtpMessageHandler::GetSearchEnginesList() {
  base::ListValue search_engines;

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

    base::DictValue engine;
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

void NeuroBrowserNtpMessageHandler::HandleGetAvailableModels(
    const base::ListValue& args) {
  AllowJavascript();

  if (args.size() < 1 || !args[0].is_string()) {
    return;
  }
  std::string callback_id = args[0].GetString();

  LOG(ERROR) << "[NeuroChat] HandleGetAvailableModels called via WebUI message-passing channel.";

  auto resource_request = std::make_unique<network::ResourceRequest>();
  resource_request->url = GURL("https://chat.neuronus.net/api/message/models/");
  resource_request->method = "GET";
  resource_request->credentials_mode = network::mojom::CredentialsMode::kOmit;

  simple_url_loader_ = network::SimpleURLLoader::Create(
      std::move(resource_request), TRAFFIC_ANNOTATION_FOR_TESTS);

  auto url_loader_factory = profile_->GetDefaultStoragePartition()
                                ->GetURLLoaderFactoryForBrowserProcess();

  if (url_loader_factory) {
    simple_url_loader_->DownloadToString(
        url_loader_factory.get(),
        base::BindOnce(&NeuroBrowserNtpMessageHandler::OnModelsFetched,
                       weak_ptr_factory_.GetWeakPtr(), callback_id),
        1024 * 1024 /* 1MB max size */);
  } else {
    LOG(ERROR) << "[NeuroChat] URLLoaderFactory is null, resolving with empty response.";
    OnModelsFetched(callback_id, std::nullopt);
  }
}

void NeuroBrowserNtpMessageHandler::OnModelsFetched(
    const std::string& callback_id,
    std::optional<std::string> response_body) {
  std::string response = "";
  int net_error = simple_url_loader_ ? simple_url_loader_->NetError() : 0;
  bool success = response_body.has_value();
  
  LOG(ERROR) << "[NeuroChat] OnModelsFetched completed. Success: " << (success ? "YES" : "NO")
             << ", NetError: " << net_error;

  if (success) {
    response = std::move(*response_body);
    LOG(ERROR) << "[NeuroChat] Response body size: " << response.size() << " bytes.";
  }

  if (IsJavascriptAllowed()) {
    ResolveJavascriptCallback(base::Value(callback_id), base::Value(response));
  } else {
    LOG(ERROR) << "[NeuroChat] OnModelsFetched: JS is disallowed, skipping callback resolution.";
  }

  base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
      FROM_HERE,
      base::BindOnce(
          [](base::WeakPtr<NeuroBrowserNtpMessageHandler> handler) {
            if (handler) {
              handler->simple_url_loader_.reset();
            }
          },
          weak_ptr_factory_.GetWeakPtr()));
}

void NeuroBrowserNtpMessageHandler::HandleSendAiMessage(
    const base::ListValue& args) {
  AllowJavascript();

  if (args.size() < 1 || !args[0].is_string()) {
    return;
  }

  std::string callback_id = args[0].GetString();

  int model_id = 4; // fallback default
  if (args.size() > 1) {
    if (args[1].is_int()) {
      model_id = args[1].GetInt();
    } else if (args[1].is_double()) {
      model_id = static_cast<int>(args[1].GetDouble());
    }
  }

  std::string content = "";
  if (args.size() > 2 && args[2].is_string()) {
    content = args[2].GetString();
  }

  std::string token = "";
  if (args.size() > 3 && args[3].is_string()) {
    token = args[3].GetString();
  }

  // Cancel any existing active loader to prevent race conditions or duplicate submissions
  if (ai_message_loader_) {
    ai_message_loader_.reset();
  }

  auto resource_request = std::make_unique<network::ResourceRequest>();
  resource_request->url = GURL("https://chat.neuronus.net/api/message");
  resource_request->method = "POST";
  resource_request->credentials_mode = network::mojom::CredentialsMode::kOmit;
  resource_request->headers.SetHeader("accept", "application/json");
  resource_request->headers.SetHeader("Authorization", "Bearer " + token);
  resource_request->headers.SetHeader("Content-Type", "application/json");

  // Construct JSON body
  base::DictValue body;
  body.Set("model_id", model_id);
  body.Set("content", content);
  std::string upload_data;
  base::JSONWriter::Write(body, &upload_data);

  ai_message_loader_ = network::SimpleURLLoader::Create(
      std::move(resource_request), TRAFFIC_ANNOTATION_FOR_TESTS);
  ai_message_loader_->AttachStringForUpload(upload_data, "application/json");
  ai_message_loader_->SetAllowHttpErrorResults(true);

  auto url_loader_factory = profile_->GetDefaultStoragePartition()
                                ->GetURLLoaderFactoryForBrowserProcess();

  if (url_loader_factory) {
    ai_message_loader_->DownloadToString(
        url_loader_factory.get(),
        base::BindOnce(&NeuroBrowserNtpMessageHandler::OnAiMessageSent,
                       weak_ptr_factory_.GetWeakPtr(), callback_id),
        1024 * 1024 /* 1MB max size */);
  } else {
    OnAiMessageSent(callback_id, std::nullopt);
  }
}

void NeuroBrowserNtpMessageHandler::OnAiMessageSent(
    const std::string& callback_id,
    std::optional<std::string> response_body) {
  std::string response = "";
  int net_error = ai_message_loader_ ? ai_message_loader_->NetError() : 0;
  int response_code = -1;
  if (ai_message_loader_ && ai_message_loader_->ResponseInfo() &&
      ai_message_loader_->ResponseInfo()->headers) {
    response_code = ai_message_loader_->ResponseInfo()->headers->response_code();
  }
  bool success = response_body.has_value();

  if (success) {
    response = std::move(*response_body);
  }

  base::ListValue headers_list;
  if (ai_message_loader_ && ai_message_loader_->ResponseInfo() &&
      ai_message_loader_->ResponseInfo()->headers) {
    size_t iter = 0;
    std::string name;
    std::string value;
    while (ai_message_loader_->ResponseInfo()->headers->EnumerateHeaderLines(
        &iter, &name, &value)) {
      base::DictValue header_item;
      header_item.Set("name", name);
      header_item.Set("value", value);
      headers_list.Append(std::move(header_item));
    }
  }

  // Build standard result object
  base::DictValue result;
  result.Set("success", success);
  result.Set("net_error", net_error);
  result.Set("response_code", response_code);
  result.Set("headers", std::move(headers_list));
  result.Set("body", response);

  std::string result_json;
  base::JSONWriter::Write(result, &result_json);

  if (IsJavascriptAllowed()) {
    ResolveJavascriptCallback(base::Value(callback_id), base::Value(result_json));
  }

  base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
      FROM_HERE,
      base::BindOnce(
          [](base::WeakPtr<NeuroBrowserNtpMessageHandler> handler) {
            if (handler) {
              handler->ai_message_loader_.reset();
            }
          },
          weak_ptr_factory_.GetWeakPtr()));
}
