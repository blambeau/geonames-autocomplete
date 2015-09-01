var CityAutocomplete = (function($){

  var CA = function(countrySelect, postalCodeInput, citySelect, cityInput) {
    this.countrySelect = $("select[id='" + countrySelect + "']");
    this.countrySelect.change(this.toggleToEmptyState.bind(this));

    this.postalCodeInput = $("input[id='" + postalCodeInput + "']");
    this.postalCodeInput.change(this.suggest.bind(this));

    this.suggestionList  = $("select[id='" + citySelect + "']");
    this.suggestionList.change(this.onSuggestionClick.bind(this));

    this.warnDiv         = $("div[id='" + citySelect + "-warn']");

    this.cityInput       = $("input[id='" + cityInput + "']");

    this.calling = false;
    this.hasChanged = false;

    this.toggleToInitState();
  };

  /**
   * General parameters for geonames web services.
   */
  CA.geonames = {
    "username": "demo"
  };

  /**
   * List of supported countries.
   *
   * NOTE: the list of supported countries is available at another webservice
   * `postalCodeCountryInfoJSON`, but we prefer hardcoding the list here to
   * avoid additional roundtrips. The list is mostly stable and can be updated
   * when geonames moves to another version.
   */
  CA.countries = [
    "AD", "AR", "AS", "AT", "AU", "AX",
    "BD", "BE", "BG", "BR",
    "CA", "CH", "CZ",
    "DE", "DK", "DO", "DZ",
    "ES", "FI", "FO", "FR",
    "GB", "GF", "GG", "GL", "GP", "GR", "GT", "GU",
    "HR", "HU",
    "IM", "IN", "IS", "IT",
    "JE", "JP", "LI", "LK", "LT", "LU",
    "MC", "MD", "MH", "MK", "MP", "MQ", "MT", "MX", "MY",
    "NL", "NO", "NZ",
    "PH", "PK", "PL", "PM", "PR", "PT",
    "RE", "RO", "RU",
    "SE", "SI", "SJ", "SK", "SM",
    "TH", "TR",
    "US",
    "VA", "VI",
    "YT",
    "ZA"
  ];

  /**
   * Returns true if the country represented by its `code` is supported
   * by geonames `postalCodeSearchJSON` webservice, false otherwise.
   */
  CA.supportsCountry = function(code) {
    return ($.inArray(code, CA.countries) != -1);
  };

  /**
   * Returns the city currently selected in the suggestions.
   */
  CA.prototype.getSelectedOption = function() {
    return this.suggestionList.find(":selected");
  };

  /**
   * Event handler when a suggestion is clicked. The postal code and city are
   * automatically copied from the suggestion list to the real fields sent to
   * Magento.
   */
  CA.prototype.onSuggestionClick = function() {
    var option = this.getSelectedOption();
    var code = option.attr('data-postal-code');
    var city = option.attr('value');
    if (code == 'none') {
      this.cityInput.val('');
    } else {
      this.postalCodeInput.val(code);
      this.cityInput.val(city);
    }
  };

  /**
   * Refreshes the list of city suggestions given the postal codes passed as
   * first parameter.
   *
   * @param postalCodes is a [{placeName: String, postalCode: String}] typically
   *   received from geonames webservices.
   */
  CA.prototype.refreshSuggestionList = function(postalCodes) {
    var suggestions = "";
    suggestions += "<option value='' data-postal-code='none'></option>";
    var seen = {};
    $.each(postalCodes, function(i, p){
      var label = p.placeName;
      if (!seen[label]) {
        suggestions += "<option data-postal-code='" + p.postalCode + "' value='" + p.placeName + "'>" + label + "</option>";
        seen[label] = true;
      }
    });
    this.suggestionList.html(suggestions);
  }

  /**
   * Make suggestions to the end user if possible.
   *
   * This method handles the suggestions logic. It is robust to the user being
   * still typing and avoids making multiple concurrent calls to geonames. In
   * case the current call is invalidated by new user input, another call will
   * be scheduled.
   *
   * When the current country is not supported, this method returns immediately.
   */
  CA.prototype.suggest = function(callback) {
    // Schedule later call if another is already ongoing.
    if (this.calling) {
      this.hasChanged = true;
      return;
    }

    // Check that a supported country is set or return.
    var country = this.countrySelect.val();
    if (!country || !CA.supportsCountry(country)) {
      return;
    }

    // On success either refresh due to changes having occured meanwhile,
    // or refresh the suggestion list and hope for the user to select one.
    var onSuccess = function(data) {
      if (this.hasChanged) {
        this.calling = false;
        this.hasChanged = false;
        this.suggest(callback);
      } else {
        this.toggleToSuggestions(data.postalCodes);
        if (callback) { callback(); }
      }
      this.calling = false;
    }.bind(this);

    // On error, simply fallback to manual mode without saying anything.
    // We don't want user registration or profile edition to be blocked
    // if geonames is not available or buggy.
    var onError = function() {
      this.hasChanged = false;
      this.calling = false;
      this.toggleToManual();
    }.bind(this);

    // Find city suggestions now!
    this.calling = true;

    var data = $.extend({
      "postalcode_startsWith": this.postalCodeInput.val(),
      "country": country
    }, CA.geonames);

    $.ajax({
      url: "http://api.geonames.org/postalCodeSearchJSON",
      method: "GET",
      data: data,
      success: onSuccess,
      error: onError
    });
  }

  /**
   * Toggle the UI to the initial state, taking care of handling
   * pre-existing values for the postcode.
   */
   CA.prototype.toggleToInitState = function() {
    var self = this;

    var postcode = this.postalCodeInput.val();
    if (!postcode || postcode.length == 0) {
      return this.toggleToEmptyState();
    } else {
      var city = this.cityInput.val();
      this.suggest(function(){
        self.cityInput.val(city);
        self.suggestionList.find('option[value="' + city + '"]').prop('selected', true);
      });
    }
   };

  /**
   * Toggle the UI to an empty state:
   * 1. no input value anywhere
   * 2. empty & hidden selection list
   * 3. empty city input, disabled only if the country is supported
   */
  CA.prototype.toggleToEmptyState = function() {
    var country = this.countrySelect.val();
    // 1.
    this.postalCodeInput.val('');
    this.cityInput.val('');
    // 2.
    this.refreshSuggestionList([]);
    this.suggestionList.hide();
    this.suggestionList.attr('disabled', true);
    // 3.
    this.cityInput.show();
    this.cityInput.attr("disabled", CA.supportsCountry(country));
  }

  /**
   * Toggle the UI to the suggestion state.
   * 1. suggestion list filled with postal codes passed as parameter,
   *    shown and with focus
   * 2. city input empty, not shown and disabled
   * 3. error message shown if sugestions are empty
   */
  CA.prototype.toggleToSuggestions = function(postalCodes) {
    // 1.
    this.refreshSuggestionList(postalCodes);
    this.suggestionList.show();
    this.suggestionList.attr('disabled', false);
    // 2.
    this.cityInput.val('');
    this.cityInput.hide();
    this.cityInput.attr("disabled", true);
    // 3.
    this.warnDiv.toggle(postalCodes.length == 0);
  };

  /**
   * Toggles the UI in manual mode:
   * 1. Suggestion list hidden
   * 2. City input shown and enabled
   */
  CA.prototype.toggleToManual = function() {
    // 1.
    this.suggestionList.hide();
    this.suggestionList.attr('disabled', true);
    // 2.
    this.cityInput.show();
    this.cityInput.attr("disabled", false);
  };

  return CA;
})(jQuery);
