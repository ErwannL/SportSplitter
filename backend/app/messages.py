"""Messages métier : un code + des paramètres, traduits côté interface.

Le texte français sert de repli (export Excel, API brute).
"""

from __future__ import annotations

from .schemas import Issue, TargetType

FR: dict[str, str] = {
    "no_timetable": "Aucun emploi du temps importé.",
    "unknown_level": "Le niveau « {level} » de l'emploi du temps n'est pas configuré.",
    "level_unused": "Le niveau « {level} » n'apparaît pas dans l'emploi du temps.",
    "level_no_sport": "Le niveau « {level} » n'a aucun sport.",
    "sport_no_place": "Le sport « {sport} » n'a aucun lieu.",
    "place_never_available": "Le lieu « {place} » n'a aucun créneau de disponibilité.",
    "duplicate_level": "Le niveau « {level} » est défini plusieurs fois.",
    "too_many_priority": "« {level} » a {count} sports prioritaires pour seulement {periods} périodes.",
    "priority_impossible": ("Le sport prioritaire « {sport} » ne peut être placé à aucune période pour « {level} » : "
                            "aucun de ses lieux n'est disponible sur tous les créneaux de ce niveau."),
    "barrette_single": "« {sport} » est en barrette mais « {level} » a des créneaux avec moins de {min} classes.",
    "sport_period_unavailable": ("« {sport} » ne peut pas être pratiqué par « {level} » au {period} : "
                                 "aucun lieu disponible sur tous ses créneaux."),
    "level_blocked": ("« {level} » : {count} période(s) sans aucun sport possible "
                      "(vérifiez les disponibilités des lieux)."),
    "not_enough_sports": "« {level} » a {count} sport(s) pour {periods} périodes et la répétition est désactivée.",
    "no_solution": ("Aucune combinaison ne respecte toutes les règles : trop de classes pour les lieux "
                    "disponibles sur certains créneaux. Ajoutez des disponibilités ou des lieux."),
    "winter_limit": ("Le meilleur planning utilise {count} fois un lieu extérieur en hiver, "
                     "au-delà de la limite autorisée ({max})."),
    "relaxed": "Aucun planning parfait : meilleure solution avec {count} règle(s) d'hiver non respectée(s).",
    "winter_outdoor": "« {level} » utilise un lieu extérieur ({place}) pendant l'hiver ({period}).",
    "duration_impossible": ("« {level} » a une séance de {duration} mais aucune suite de créneaux ouverts "
                            "de cette durée n'existe dans la grille."),
    "too_many_sessions": "« {level} » a {count} séances dans une semaine pour seulement {days} jours.",
    "separate_limit": ("Le meilleur planning met {count} fois des classes d'un même niveau dans le même lieu, "
                       "au-delà de la limite autorisée ({max})."),
    "same_place": "Plusieurs classes de « {level} » partagent « {place} » ({period}).",
    "separate_impossible": ("« {sport} » n'a pas assez de lieux pour séparer les {count} classes de « {level} » "
                            "(hors barrette, chaque classe doit être dans un lieu différent)."),
    "level_alone_impossible": ("« {level} » ne peut pas être planifié, même seul : ses sports, leurs lieux et "
                               "leurs disponibilités ne permettent pas de couvrir toutes ses périodes."),
    "place_overloaded": ("« {place} » est demandé par trop de classes en même temps : {levels} le {day} à {time} "
                         "({segment}), alors qu'il n'accueille que {capacity} classe(s)."),
    "no_level": "Aucun niveau n'est configuré.",
    "level_no_session": "Le niveau « {level} » n'a aucune séance dans son rythme.",
    "row_no_duration": "Le créneau « {row} » n'a pas d'heure de début et de fin lisible.",
}

EN: dict[str, str] = {
    "no_timetable": "No timetable imported.",
    "unknown_level": "Level “{level}” from the timetable is not configured.",
    "level_unused": "Level “{level}” does not appear in the timetable.",
    "level_no_sport": "Level “{level}” has no sport.",
    "sport_no_place": "Sport “{sport}” has no place.",
    "place_never_available": "Place “{place}” is never available.",
    "duplicate_level": "Level “{level}” is defined more than once.",
    "too_many_priority": "“{level}” has {count} priority sports for only {periods} periods.",
    "priority_impossible": ("Priority sport “{sport}” cannot be placed in any period for “{level}”: "
                            "none of its places is available on all of this level's slots."),
    "barrette_single": "“{sport}” is a paired sport but “{level}” has slots with fewer than {min} classes.",
    "sport_period_unavailable": ("“{sport}” cannot be done by “{level}” during the {period}: "
                                 "no place available on all its slots."),
    "level_blocked": "“{level}”: {count} period(s) with no possible sport (check place availability).",
    "not_enough_sports": "“{level}” has {count} sport(s) for {periods} periods and repetition is disabled.",
    "no_solution": ("No combination satisfies every rule: too many classes for the places available on some "
                    "slots. Add availability or places."),
    "winter_limit": ("The best planning uses an outdoor place in winter {count} time(s), "
                     "above the allowed limit ({max})."),
    "relaxed": "No perfect planning: best solution breaks the winter rule {count} time(s).",
    "winter_outdoor": "“{level}” uses an outdoor place ({place}) during winter ({period}).",
    "duration_impossible": ("“{level}” has a {duration} session but no run of open slots of that length "
                            "exists in the grid."),
    "too_many_sessions": "“{level}” has {count} sessions in one week for only {days} days.",
    "separate_limit": ("The best planning puts classes of the same level in the same place {count} time(s), "
                       "above the allowed limit ({max})."),
    "same_place": "Several classes of “{level}” share “{place}” ({period}).",
    "separate_impossible": ("“{sport}” does not have enough places to split the {count} classes of “{level}” "
                            "(unless paired, each class must be in a different place)."),
    "level_alone_impossible": ("“{level}” cannot be scheduled even on its own: its sports, their places and "
                               "their availability cannot cover all its periods."),
    "place_overloaded": ("“{place}” is needed by too many classes at once: {levels} on {day} at {time} "
                         "({segment}), but it only takes {capacity} class(es)."),
    "no_level": "No level is set up.",
    "level_no_session": "Level “{level}” has no session in its rhythm.",
    "row_no_duration": "Slot “{row}” has no readable start and end time.",
}

PERIODS_I18N = {
    "fr": {"T1": "1er trimestre", "T2": "2e trimestre", "T3": "3e trimestre", "S1": "1er semestre", "S2": "2e semestre"},
    "en": {"T1": "1st term", "T2": "2nd term", "T3": "3rd term", "S1": "1st semester", "S2": "2nd semester"},
}


def render(code: str, params: dict, lang: str = "fr") -> str:
    p = dict(params)
    if "period" in p:
        p["period"] = PERIODS_I18N[lang].get(str(p["period"]), p["period"])
    return (EN if lang == "en" else FR)[code].format(**p)


def issue(code: str, *, severity: str = "error", target: str | None = None,
          target_type: TargetType | None = None, **params) -> Issue:
    return Issue(severity=severity, code=code, message=render(code, params), target=target,
                 targetType=target_type, params=params)
