import _ from "lodash";
const _html_no_properties_found = 'no relevant properties found';
const _html_na = 'n/a';
const supportedC7ConditionalGateways = ['bpmn:ExclusiveGateway', 'bpmn:InclusiveGateway', 'bpmn:ComplexGateway']
const supportedC8ConditionalGateways = ['bpmn:ExclusiveGateway', 'bpmn:InclusiveGateway']
export const _html_ok = '&#10004;';
export const _html_nok = '&#10006;';

/**
 * create tooltip-overlay with options and content
 */
export function overlay(html) {
  return {
    position: { top: -30, left: 0 },
    scale: false,
    show: { maxZoom: 2 },
    html: html
  }
}


/**
 * add tooltip header
 */
export function tooltipHeader(element) {
  // .split(':')[1] is used to transform 'bpmn:ServiceTask' into 'ServiceTask'
  return '<div class="tooltip-header"> \
              <div class="tooltip-container">'+ element.type.split(':')[1] + '</div>\
            </div>';
}


/**
 * show some hint in tooltip, if no relevant property was found,
 * otherwise join all lines that include some information
 */
export function emptyPropertiesIfNoLines(lines) {
  let final = _.without(lines, "");
  if (final.length === 0) {
    return `<div class="tooltip-no-properties">${_html_no_properties_found}</div>`;
  }
  return final.join('');
}

/**
 * container for conditional sequence flows:
 *  - evaluate outgoing sequence flows, if they are conditional or default
 */
export function tooltipConditionalOutgoingSequenceFlows(element, isC7Model) {
  let defaultFlow;
  let isSupportedGateway = isC7Model ? supportedC7ConditionalGateways.includes(element.type) :
      supportedC8ConditionalGateways.includes(element.type)

  if (element.outgoing === undefined || !isSupportedGateway) return '';

  let html = '<div class="tooltip-container"> \
                  <div class="tooltip-subheader">Conditional Sequence-Flows</div>';

  if (element.businessObject.default !== undefined) {
    defaultFlow = element.businessObject.default.id;
  }

  _.each(element.outgoing, function (outgoingFlow) {
    if (outgoingFlow.id === defaultFlow) {
      // default flow (there is only one)
      html += tooltipLineText((outgoingFlow.businessObject.name || _html_na),  + '<br />' + 'default');

    } else if (outgoingFlow.businessObject.conditionExpression === undefined) {
      // no expression given
      html += tooltipLineText((outgoingFlow.businessObject.name || _html_na), '<br />' + _html_na);

    } else {
      // conditional / script flows
      let scriptFormat = outgoingFlow.businessObject.conditionExpression.language;
      if (scriptFormat !== undefined) { // only relevant for C7 models
        let scriptFormatToBeDisplayed = scriptFormat.trim().length > 0 ? scriptFormat : 'Not Selected'
        let conditionalScript = '<br />' + 'Script Format: ' + scriptFormatToBeDisplayed + '<br />'

        if (outgoingFlow.businessObject.conditionExpression.resource !== undefined) {
          conditionalScript += 'Script Type: ' + 'External Resource' + '<br />'
          conditionalScript += outgoingFlow.businessObject.conditionExpression.resource
        } else {
          conditionalScript += 'Script Type: ' + 'Inline Script' + '<br />'
          if (outgoingFlow.businessObject.conditionExpression.body === undefined) {
            conditionalScript += _html_na
          } else {
            conditionalScript += outgoingFlow.businessObject.conditionExpression.body.replace(/(?:\r\n|\r|\n)/g, '<br />');
          }
        }

        html += tooltipLineCode(outgoingFlow.businessObject.name || _html_na, conditionalScript);
      } else { // relevant for both C7 and C8 models
        let expressionBody = outgoingFlow.businessObject.conditionExpression.body
        let conditionalExpression = '<br />' + (expressionBody === undefined ? _html_na : expressionBody)
        html += tooltipLineCode(outgoingFlow.businessObject.name || _html_na, conditionalExpression);
      }
    }
  });

  return html += '</div>';
}

/**
 *
 * helpers fpr bpmn-elements
 *
 */

function checkExtensionElementsAvailable(element) {
  if (element === undefined
      || element.businessObject === undefined
      || element.businessObject.extensionElements === undefined
      || element.businessObject.extensionElements.values === undefined
      || element.businessObject.extensionElements.values.length === 0)
    return false;

  return true;
}

export function findExtensionByType(element, type) {
  if (!checkExtensionElementsAvailable(element))
    return undefined;

  return findExtension(element.businessObject.extensionElements.values, type);
}

export function findExtension(values, type) {
  return _.find(values, function (value) { return value.$type === type; });
}


export function findBusinessKey(element) {
  if (!checkExtensionElementsAvailable(element)) return undefined;

  return _.find(element.businessObject.extensionElements.values,
      function (value) {
        return value.$type === 'camunda:In' && value.businessKey !== undefined
      });
}

export function findEventDefinitionType(element, type) {
  if (element === undefined
      || element.businessObject === undefined
      || element.businessObject.eventDefinitions === undefined
      || element.businessObject.eventDefinitions.length === 0)
    return undefined;
  return _.find(element.businessObject.eventDefinitions, function (value) { return value.$type === type; });
}

/* >-- methods to assemble tooltip lines --< */

/**
 * add a single tooltip line as 'text'
 */
export function tooltipLineText(key, value) {
  return tooltipLineWithCss(key, value, 'tooltip-value-text');
}

/**
 * add a single tooltip line as 'code'
 */
export function tooltipLineCode(key, value) {
  return tooltipLineWithCss(key, value, 'tooltip-value-code');
}

/**
 * add a single tooltip line as 'code'
 */
export function tooltipLineCodeWithFallback(key, value, fallback) {
  if (value === undefined) {
    return tooltipLineCode(key, fallback);
  } else {
    return tooltipLineCode(key, value);
  }
}

/**
 * add a single tooltip line as <div> with 2 <span>,
 * like: <div><span>key: </span><span class="css">value</span></div>
 */
function tooltipLineWithCss(key, value, css) {
  if (value === undefined) return '';
  return `<div class="tooltip-line"><span class="tooltip-key">${key}:&nbsp;</span><span class="tooltip-value ${css}">${value}</span></div>`;
}

/**
 * create a tooltip-container with header (e.g. 'Details') and add all respective properties.
 * if there is no property present, the container is not created.
 */
export function addHeaderRemoveEmptyLinesAndFinalize(subheader, lines) {
  let final = _.without(lines, "");
  if (final.length === 0) return '';

  let html = '<div class="tooltip-container"> \
                  <div class="tooltip-subheader">' + subheader + '</div>';

  _.each(final, function (line) {
    html += line;
  });

  return html += '</div>';
}
