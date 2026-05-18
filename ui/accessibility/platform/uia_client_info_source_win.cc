// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "ui/accessibility/platform/uia_client_info_source_win.h"

#include <Unknwn.h>

struct IUIAutomationClientInfoSource : public IUnknown {
  virtual HRESULT STDMETHODCALLTYPE GetConnectedClients(SAFEARRAY** retVal) = 0;
  virtual HRESULT STDMETHODCALLTYPE RegisterClientConnectionCallback(
      IUnknown* callback,
      uint64_t* cookie) = 0;
  virtual HRESULT STDMETHODCALLTYPE UnregisterClientConnectionCallback(
      uint64_t cookie) = 0;
};

namespace ui {

UiaClientInfoSource::~UiaClientInfoSource() = default;

// static
std::optional<UiaClientInfoSource> UiaClientInfoSource::Create(
    ConnectionCallback callback) {
  return std::nullopt;
}

UiaClientInfoSource::UiaClientInfoSource(UiaClientInfoSource&& other) noexcept
    : client_info_source_(std::move(other.client_info_source_)),
      callback_cookie_(std::move(other.callback_cookie_)) {}

UiaClientInfoSource& UiaClientInfoSource::operator=(
    UiaClientInfoSource&& other) {
  client_info_source_ = std::move(other.client_info_source_);
  callback_cookie_ = std::move(other.callback_cookie_);
  return *this;
}

std::vector<std::string> UiaClientInfoSource::GetConnectedClientProcessNames() {
  return {};
}

UiaClientInfoSource::UiaClientInfoSource(
    Microsoft::WRL::ComPtr<IUIAutomationClientInfoSource> client_info_source,
    std::optional<uint64_t> callback_cookie)
    : client_info_source_(std::move(client_info_source)),
      callback_cookie_(callback_cookie) {}

// static
std::optional<UiaClientInfoSource> UiaClientInfoSource::CreateForTesting(
    Microsoft::WRL::ComPtr<IUIAutomationClientInfoSource> client_info_source,
    ConnectionCallback callback) {
  return std::nullopt;
}

// static
std::optional<UiaClientInfoSource>
UiaClientInfoSource::CreateFromClientInfoSource(
    Microsoft::WRL::ComPtr<IUIAutomationClientInfoSource> client_info_source,
    ConnectionCallback callback) {
  return std::nullopt;
}

HRESULT UiaClientInfoSource::UnregisterConnectionCallback() {
  return S_OK;
}

}  // namespace ui
