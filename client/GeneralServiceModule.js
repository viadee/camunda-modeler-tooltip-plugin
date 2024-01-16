import _ from "lodash";
const _html_no_properties_found = 'no relevant properties found';

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
  var final = _.without(lines, "");
  if (final.length == 0) {
    return `<div class="tooltip-no-properties">${_html_no_properties_found}</div>`;
  }
  return final.join('');
}

/**
 *
 * helpers fpr bpmn-elements
 *
 */

function checkExtensionElementsAvailable(element) {
  if (element == undefined
      || element.businessObject == undefined
      || element.businessObject.extensionElements == undefined
      || element.businessObject.extensionElements.values == undefined
      || element.businessObject.extensionElements.values.length == 0)
    return false;

  return true;
}

export function findExtensionByType(element, type) {
  if (!checkExtensionElementsAvailable(element))
    return undefined;

  return findExtension(element.businessObject.extensionElements.values, type);
}

export function findExtension(values, type) {
  return _.find(values, function (value) { return value.$type == type; });
}


export function findBusinessKey(element) {
  if (!checkExtensionElementsAvailable(element)) return undefined;

  return _.find(element.businessObject.extensionElements.values,
      function (value) {
        return value.$type == 'camunda:In' && value.businessKey != undefined
      });
}

export function findEventDefinitionType(element, type) {
  if (element == undefined
      || element.businessObject == undefined
      || element.businessObject.eventDefinitions == undefined
      || element.businessObject.eventDefinitions.length == 0)
    return undefined;
  return _.find(element.businessObject.eventDefinitions, function (value) { return value.$type == type; });
}
