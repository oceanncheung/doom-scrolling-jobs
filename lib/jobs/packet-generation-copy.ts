const INCOMPLETE_ATS_MARKER = 'Resume generation returned incomplete ATS content.'

export function isIncompleteAtsGenerationError(error?: string) {
  return Boolean(error?.trim().includes(INCOMPLETE_ATS_MARKER))
}

export function getPacketGenerationUserMessage(error?: string) {
  const message = error?.trim() ?? ''

  if (!message) {
    return ''
  }

  if (message.includes(INCOMPLETE_ATS_MARKER)) {
    return 'The profile does not have enough structured resume material yet to generate a reliable tailored resume.'
  }

  return 'The application materials could not be generated yet.'
}

export function getPacketGenerationRemediationHint(error?: string) {
  const message = error?.trim() ?? ''

  if (message.includes(INCOMPLETE_ATS_MARKER)) {
    return 'Update the profile fields marked for review in Profile, save, then try generating again.'
  }

  if (!message) {
    return ''
  }

  return 'Check the profile materials and experience, then try generating again.'
}
